import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateDiscount, normalizeCouponCode } from '@/lib/discount';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/api/public-rate-limit';
import { getRequiredSupabaseServiceEnv, isSupabaseConfigurationError } from '@/lib/supabase/env';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { storeOrderItemsSchema } from '@/lib/store-order-validation';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{2,40}$/),
  items: storeOrderItemsSchema,
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await readJsonObject(request, 16 * 1024));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Podaj prawidłowy kod rabatowy.' }, { status: 400 });
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createServiceRoleClient(url, serviceRoleKey);
    const rateLimit = await checkPublicRateLimit(request, {
      scope: 'coupon_validate',
      limit: 20,
      windowSeconds: 60 * 60,
      consumePersistent: async (args) => {
        const { data, error } = await admin.rpc('consume_public_api_rate_limit', args);
        return { data: data === true, error };
      },
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(
        'Wykonano zbyt wiele prób użycia kuponu. Spróbuj ponownie później.',
        rateLimit.retryAfter
      );
    }

    const ids = parsed.data.items.map((item) => item.id);
    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id, price, active')
      .in('id', ids);

    if (productsError) throw productsError;
    const productById = new Map((products || []).map((product) => [product.id, product]));
    let subtotal = 0;
    for (const item of parsed.data.items) {
      const product = productById.get(item.id);
      if (!product?.active) {
        return NextResponse.json(
          { error: 'Koszyk zawiera niedostępny produkt.' },
          { status: 409 }
        );
      }
      subtotal += Number(product.price) * item.quantity;
    }

    const code = normalizeCouponCode(parsed.data.code);
    const { data: coupon, error: couponError } = await admin
      .from('discount_codes')
      .select('code, discount_type, discount_value, min_order_value, max_uses, used_count, active, expires_at')
      .eq('code', code)
      .maybeSingle();

    if (couponError) throw couponError;
    const result = calculateDiscount(coupon, subtotal);
    if (!result.valid) {
      return NextResponse.json(
        {
          error:
            result.reason === 'minimum'
              ? 'Wartość koszyka jest za mała dla tego kuponu.'
              : 'Kod rabatowy jest nieprawidłowy, wygasł albo wykorzystano jego limit.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Kupony są chwilowo niedostępne.' },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
      );
    }
    console.error('Coupon validation error:', error);
    return NextResponse.json(
      { error: 'Nie udało się sprawdzić kuponu.' },
      { status: 500 }
    );
  }
}
