import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import {
  getStripeCheckoutOrigin,
  getStripeServer,
  getStripeWebhookSecret,
  isStripeConfigurationError,
} from '@/lib/stripe';
import { verifyCheckoutToken } from '@/lib/checkout-token';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import {
  crossSiteRequestResponse,
  isTrustedMutationRequest,
} from '@/lib/api/request-security';
import { createClient } from '@/lib/supabase/server';
import { sendPaymentLinkEmailSafely } from '@/lib/email/smtp';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  orderId: z.string().uuid(),
  paymentToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request)) return crossSiteRequestResponse();

  try {
    const parsed = requestSchema.safeParse(await readJsonObject(request, 8 * 1024));
    if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe zamówienie.' }, { status: 400 });

    const stripe = getStripeServer();
    getStripeWebhookSecret();
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);
    const { data: order, error: orderError } = await admin
      .from('store_orders')
      .select('id, order_number, user_id, status, customer_email, customer_name, total, vat_amount, shipping_cost, discount_amount, coupon_code, stripe_session_id, checkout_token_hash')
      .eq('id', parsed.data.orderId)
      .maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 });
    const validPaymentToken = parsed.data.paymentToken
      ? verifyCheckoutToken(parsed.data.paymentToken, order.checkout_token_hash)
      : false;
    let authenticatedOwner = false;
    if (!validPaymentToken && order.user_id) {
      const supabase = await createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError && (authError.status || 0) >= 500) throw authError;
      authenticatedOwner = auth.user?.id === order.user_id;
    }
    if (!validPaymentToken && !authenticatedOwner) {
      return NextResponse.json({ error: 'Brak dostępu do płatności tego zamówienia.' }, { status: 403 });
    }
    if (order.status !== 'pending') return NextResponse.json({ error: 'To zamówienie nie oczekuje na płatność.' }, { status: 409 });

    if (order.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (existing.status === 'open' && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
      if (existing.status === 'complete') {
        return NextResponse.json({ error: 'Płatność dla tego zamówienia została już zakończona.' }, { status: 409 });
      }
      if (existing.status === 'expired') {
        const { error: cancellationError } = await admin.rpc(
          'cancel_store_order_and_restore_stock_locked',
          { p_order_id: order.id }
        );
        if (cancellationError) throw cancellationError;
        return NextResponse.json(
          { error: 'Sesja płatności wygasła. Złóż zamówienie ponownie.' },
          { status: 409 }
        );
      }
    }

    const { data: items, error: itemsError } = await admin
      .from('store_order_items')
      .select('name, sku, quantity, unit_price, total')
      .eq('order_id', order.id);
    if (itemsError || !items?.length) return NextResponse.json({ error: 'Zamówienie nie zawiera produktów.' }, { status: 422 });

    const shippingCost = Number(order.shipping_cost || 0);
    const shippingCents = Math.round(shippingCost * 100);
    const itemsTotalCents = items.reduce(
      (sum, item) => sum + Math.round(Number(item.unit_price) * 100) * item.quantity,
      0
    );
    const discountCents = Math.round(Number(order.discount_amount || 0) * 100);
    if (
      !Number.isInteger(discountCents) ||
      discountCents < 0 ||
      discountCents > itemsTotalCents
    ) {
      return NextResponse.json(
        { error: 'Rabat zamówienia jest nieprawidłowy.' },
        { status: 409 }
      );
    }
    const discountedItemsCents = itemsTotalCents - discountCents;
    const calculatedTotalCents = discountedItemsCents + shippingCents;
    const expectedTotalCents = Math.round(Number(order.total) * 100);
    if (calculatedTotalCents !== expectedTotalCents) {
      console.error('Stripe total mismatch:', { orderId: order.id, calculatedTotalCents, expectedTotalCents });
      return NextResponse.json({ error: 'Kwota zamówienia wymaga ponownego przeliczenia.' }, { status: 409 });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = discountCents > 0
      ? discountedItemsCents > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: 'pln',
                unit_amount: discountedItemsCents,
                product_data: {
                  name: `Zamówienie ${order.order_number} po rabacie`,
                  description: items.map((item) => `${item.name} × ${item.quantity}`).join(', ').slice(0, 500),
                  metadata: { coupon_code: order.coupon_code || '' },
                },
              },
            },
          ]
        : []
      : items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: 'pln',
            unit_amount: Math.round(Number(item.unit_price) * 100),
            product_data: { name: item.name, metadata: { sku: item.sku } },
          },
        }));

    if (shippingCost > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'pln',
          unit_amount: Math.round(shippingCost * 100),
          product_data: { name: 'Dostawa', metadata: { sku: 'shipping' } },
        },
      });
    }
    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Wartość zamówienia po rabacie jest zbyt niska do płatności online.' },
        { status: 409 }
      );
    }

    const origin = getStripeCheckoutOrigin(request.nextUrl.origin);
    const paymentMetadata = {
      order_id: order.id,
      order_number: order.order_number,
      currency: 'pln',
      vat_amount: Number(order.vat_amount || 0).toFixed(2),
      prices_include_tax: 'true',
    };
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        customer_email: order.customer_email,
        client_reference_id: order.id,
        metadata: paymentMetadata,
        payment_intent_data: {
          metadata: paymentMetadata,
        },
        // Ceny w bazie są końcowymi cenami brutto. Stripe Tax pozostaje wyłączony,
        // aby podatek nie został doliczony klientowi drugi raz.
        automatic_tax: { enabled: false },
        success_url: `${origin}/checkout/sukces?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout?cancelled=1&order=${encodeURIComponent(order.id)}`,
        billing_address_collection: 'auto',
        locale: 'pl',
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      { idempotencyKey: `korix3d-checkout-${order.id}` }
    );

    const { data: savedOrder, error: sessionSaveError } = await admin
      .from('store_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id)
      .eq('status', 'pending')
      .is('stripe_session_id', null)
      .select('id')
      .maybeSingle();
    if (sessionSaveError) {
      await stripe.checkout.sessions.expire(session.id);
      await admin.rpc('cancel_store_order_and_restore_stock_locked', { p_order_id: order.id });
      throw sessionSaveError;
    }

    if (!savedOrder) {
      const { data: currentOrder, error: currentOrderError } = await admin
        .from('store_orders')
        .select('status, stripe_session_id')
        .eq('id', order.id)
        .maybeSingle();
      if (currentOrderError) throw currentOrderError;

      if (
        currentOrder?.status === 'pending'
        && currentOrder.stripe_session_id === session.id
      ) {
        return NextResponse.json({ url: session.url });
      }

      if (currentOrder?.status === 'paid' && currentOrder.stripe_session_id === session.id) {
        return NextResponse.json(
          { error: 'Płatność dla tego zamówienia została już zakończona.' },
          { status: 409 }
        );
      }

      if (session.status === 'open') {
        await stripe.checkout.sessions.expire(session.id);
      }
      return NextResponse.json(
        { error: 'Stan zamówienia zmienił się podczas przygotowywania płatności. Spróbuj ponownie.' },
        { status: 409 }
      );
    }

    if (session.url) {
      await sendPaymentLinkEmailSafely({
        to: order.customer_email,
        customerName: order.customer_name,
        orderNumber: order.order_number,
        paymentUrl: session.url,
        totalGross: Number(order.total),
        expiresAt: new Date(session.expires_at * 1000),
        orderType: 'store',
      });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: 'stripe_not_configured' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Płatności są chwilowo niedostępne.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    console.error('Stripe checkout session error:', error);
    return NextResponse.json({ error: 'Nie udało się przygotować płatności.' }, { status: 500 });
  }
}
