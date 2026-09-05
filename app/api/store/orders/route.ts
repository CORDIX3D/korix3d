import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { parseDeliveryOptions } from '@/lib/shipping';
import { createCheckoutToken } from '@/lib/checkout-token';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/api/public-rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { storeOrderSchema } from '@/lib/store-order-validation';
import { sendOrderUpdateEmailSafely } from '@/lib/email/smtp';

export const dynamic = 'force-dynamic';

async function releaseAbandonedReservations(
  admin: ReturnType<typeof createServiceRoleClient>
) {
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: abandoned, error } = await admin
    .from('store_orders')
    .select('id')
    .eq('status', 'pending')
    .is('stripe_session_id', null)
    .lt('created_at', staleBefore)
    .limit(25);

  if (error) {
    console.warn('Abandoned checkout lookup failed:', error.code || 'unknown');
    return;
  }

  await Promise.all(
    (abandoned || []).map(async (order) => {
      const { error: cancellationError } = await admin.rpc(
        'cancel_store_order_and_restore_stock_locked',
        { p_order_id: order.id }
      );
      if (cancellationError) {
        console.warn('Abandoned checkout cleanup failed:', cancellationError.code || 'unknown');
      }
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    const parsed = storeOrderSchema.safeParse(await readJsonObject(request, 64 * 1024));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Sprawdź dane kontaktowe, adres i zawartość koszyka.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    let admin: ReturnType<typeof createServiceRoleClient>;
    try {
      const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
      admin = createServiceRoleClient(url, serviceRoleKey, auth.user?.id);
    } catch {
      return NextResponse.json(
        { error: 'Składanie zamówień jest chwilowo niedostępne.' },
        { status: 503 }
      );
    }

    const rateLimit = await checkPublicRateLimit(request, {
      scope: 'store_order_create',
      limit: 5,
      windowSeconds: 60 * 60,
      userId: auth.user?.id,
      consumePersistent: async (args) => {
        const { data, error } = await admin.rpc('consume_public_api_rate_limit', args);
        return { data: data === true, error };
      },
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(
        'Osiągnięto limit nowych zamówień. Spróbuj ponownie później.',
        rateLimit.retryAfter
      );
    }

    await releaseAbandonedReservations(admin);

    const orderNumber = `SK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const { data: shippingSettings, error: shippingError } = await admin
      .from('settings')
      .select('key, label, value')
      .eq('category', 'shipping');

    if (shippingError) {
      console.error('Shipping settings fetch error:', shippingError);
      return NextResponse.json(
        { error: 'Nie udało się pobrać aktualnych metod dostawy.' },
        { status: 503, headers: { 'Retry-After': '60' } }
      );
    }

    const deliverySetting = parseDeliveryOptions(shippingSettings || [])
      .find((option) => option.value === parsed.data.deliveryType);

    if (!deliverySetting) {
      return NextResponse.json(
        { error: 'Wybrana metoda dostawy jest niedostępna. Odśwież stronę i wybierz metodę ponownie.' },
        { status: 409 }
      );
    }

    const shippingCost = deliverySetting.price;

    const { data: order, error: orderError } = await admin.rpc('create_store_order_with_stock_locked', {
      p_user_id: auth.user?.id || null,
      p_order_number: orderNumber,
      p_customer_email: parsed.data.customer.email,
      p_customer_name: parsed.data.customer.name,
      p_shipping_address: {
        ...parsed.data.shippingAddress,
        name: parsed.data.customer.name,
        phone: parsed.data.customer.phone,
        delivery_type: parsed.data.deliveryType,
        delivery_label: deliverySetting.label,
      },
      p_billing_address: parsed.data.billingAddress,
      p_shipping_cost: shippingCost,
      p_coupon_code: parsed.data.couponCode || null,
      p_items: parsed.data.items,
    });

    if (orderError) {
      if (orderError.code === 'P0003') {
        return NextResponse.json(
          { error: 'Kod rabatowy jest nieprawidłowy, wygasł albo nie spełnia warunków.' },
          { status: 400 }
        );
      }
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
        await admin.rpc('cancel_store_order_and_restore_stock_locked', { p_order_id: orderId });
        return NextResponse.json(
          { error: 'Nie udało się bezpiecznie przygotować płatności.' },
          { status: 500 }
        );
      }
      paymentToken = checkoutToken.token;

      await sendOrderUpdateEmailSafely({
        to: parsed.data.customer.email,
        customerName: parsed.data.customer.name,
        orderNumber: savedOrderNumber,
        orderType: 'store',
        event: 'placed',
        totalGross: typeof order === 'object' && order !== null && 'total' in order ? Number(order.total) : null,
        panelUrl: auth.user
          ? `https://korix3d.pl/panel/zamowienia/sklep/${orderId}`
          : 'https://korix3d.pl/logowanie',
      });
    }

    return NextResponse.json({
      orderId,
      orderNumber: savedOrderNumber,
      paymentToken,
      total: typeof order === 'object' && order !== null && 'total' in order ? Number(order.total) : undefined,
      discountAmount:
        typeof order === 'object' && order !== null && 'discountAmount' in order
          ? Number(order.discountAmount)
          : 0,
      couponCode:
        typeof order === 'object' && order !== null && 'couponCode' in order
          ? String(order.couponCode || '') || null
          : null,
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
