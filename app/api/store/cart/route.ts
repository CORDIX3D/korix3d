import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/api/public-rate-limit';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { PUBLIC_PRODUCT_SELECT } from '@/lib/public-product';
import { storeOrderItemsSchema } from '@/lib/store-order-validation';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({ items: storeOrderItemsSchema });

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await readJsonObject(request, 16 * 1024));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Koszyk zawiera nieprawidłowe pozycje.' },
        { status: 400 }
      );
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createServiceRoleClient(url, serviceRoleKey);
    const rateLimit = await checkPublicRateLimit(request, {
      scope: 'cart_refresh',
      limit: 60,
      windowSeconds: 60 * 60,
      consumePersistent: async (args) => {
        const { data, error } = await admin.rpc('consume_public_api_rate_limit', args);
        return { data: data === true, error };
      },
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(
        'Koszyk był odświeżany zbyt często. Spróbuj ponownie później.',
        rateLimit.retryAfter
      );
    }

    const requestedIds = parsed.data.items.map((item) => item.id);
    const { data, error } = await admin
      .from('products')
      .select(PUBLIC_PRODUCT_SELECT)
      .in('id', requestedIds)
      .eq('active', true);
    if (error) throw error;

    const productById = new Map((data || []).map((product) => [product.id, product]));
    const products = requestedIds
      .map((id) => productById.get(id))
      .filter((product) => product !== undefined);
    const unavailableIds = requestedIds.filter((id) => !productById.has(id));

    return NextResponse.json(
      { products, unavailableIds },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Nie można teraz potwierdzić aktualności koszyka.' },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
      );
    }
    console.error('Cart refresh failed.');
    return NextResponse.json(
      { error: 'Nie udało się odświeżyć koszyka.' },
      { status: 500 }
    );
  }
}
