import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { DEFAULT_DELIVERY_OPTIONS, IGNORED_SHIPPING_SETTING_KEYS } from '@/lib/shipping';
import { createCheckoutToken } from '@/lib/checkout-token';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { createServiceRoleClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(7).max(30),
  }),
  shippingAddress: z.object({
    street: z.string().trim().min(3).max(160),
    postalCode: z.string().trim().regex(/^\d{2}-\d{3}$/),
    city: z.string().trim().min(2).max(100),
    country: z.literal('PL'),
  }),
  deliveryType: z.string().trim().min(1).max(80),
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = orderSchema.safeParse(await readJsonObject(request, 64 * 1024));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Sprawdź dane kontaktowe, adres i zawartość koszyka.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    let admin;
    try {
      const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
      admin = createServiceRoleClient(url, serviceRoleKey, auth.user?.id);
    } catch {
      return NextResponse.json(
        { error: 'Składanie zamówień jest chwilowo niedostępne.' },
        { status: 503 }
      );
    }

    const orderNumber = `SK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: shippingSettings, error: shippingError } = await admin
      .from('settings')
      .select('key, label, value')
      .eq('category', 'shipping');

    if (shippingError) {
      console.error('Shipping settings fetch error:', shippingError);
    }

    const availableShippingSettings = (shippingSettings || []).filter(
      (setting: { key: string | null }) =>
        Boolean(setting.key) && !IGNORED_SHIPPING_SETTING_KEYS.has(String(setting.key))
    );
    const deliverySetting = availableShippingSettings.find((setting: { key: string | null }) => {
      const key = String(setting.key);
      return key === parsed.data.deliveryType || key.replace(/_price$/, '') === parsed.data.deliveryType;
    });
    const defaultDelivery =
      shippingError || availableShippingSettings.length === 0
        ? DEFAULT_DELIVERY_OPTIONS.find((option) => option.value === parsed.data.deliveryType)
        : undefined;

    if (!deliverySetting && !defaultDelivery) {
      return NextResponse.json(
        { error: 'Wybrana metoda dostawy jest niedostępna. Odśwież stronę i wybierz metodę ponownie.' },
        { status: 400 }
      );
    }

    const shippingCost = deliverySetting
      ? Number(String(deliverySetting.value ?? '0').replace(',', '.'))
      : Number(defaultDelivery?.price ?? 0);
    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      return NextResponse.json(
        { error: 'Konfiguracja kosztu dostawy jest nieprawidłowa.' },
        { status: 500 }
      );
    }

    const { data: order, error: orderError } = await admin.rpc('create_store_order_with_stock', {
      p_user_id: auth.user?.id || null,
      p_order_number: orderNumber,
      p_customer_email: parsed.data.customer.email,
      p_customer_name: parsed.data.customer.name,
      p_shipping_address: {
        ...parsed.data.shippingAddress,
        phone: parsed.data.customer.phone,
        delivery_type: parsed.data.deliveryType,
        delivery_label: deliverySetting?.label || deliverySetting?.key || defaultDelivery?.label,
      },
      p_billing_address: parsed.data.shippingAddress,
      p_shipping_cost: shippingCost,
      p_items: parsed.data.items,
    });

    if (orderError) {
      if (['23514', 'P0002', '22023'].includes(orderError.code || '')) {
        return NextResponse.json(
          { error: 'Jeden z produktów jest niedostępny w wybranej ilości. Odśwież koszyk.' },
          { status: 409 }
        );
      }

      console.error('Store order transaction error:', orderError);
      return NextResponse.json(
        { error: 'Nie udało się zapisać zamówienia. Spróbuj ponownie.' },
        { status: 500 }
      );
    }

    const savedOrderNumber =
      typeof order === 'object' && order !== null && 'orderNumber' in order
        ? String(order.orderNumber || orderNumber)
        : orderNumber;

    const orderId = typeof order === 'object' && order !== null && 'orderId' in order
      ? String(order.orderId)
      : null;

    let paymentToken: string | null = null;
    if (orderId) {
      const checkoutToken = createCheckoutToken();
      const { error: tokenError } = await admin
        .from('store_orders')
        .update({ checkout_token_hash: checkoutToken.hash })
        .eq('id', orderId);

      if (tokenError) {
        console.error('Store order payment token error:', tokenError);
        await admin.rpc('cancel_store_order_and_restore_stock', { p_order_id: orderId });
        return NextResponse.json(
          { error: 'Nie udało się bezpiecznie przygotować płatności.' },
          { status: 500 }
        );
      }
      paymentToken = checkoutToken.token;
    }

    return NextResponse.json({
      orderId,
      orderNumber: savedOrderNumber,
      paymentToken,
      total: typeof order === 'object' && order !== null && 'total' in order ? Number(order.total) : undefined,
    });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Składanie zamówień jest chwilowo niedostępne.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    console.error('Store order API error:', error);
    return NextResponse.json(
      { error: 'Nie udało się złożyć zamówienia.' },
      { status: 500 }
    );
  }
}
