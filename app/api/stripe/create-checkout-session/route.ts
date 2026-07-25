import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { getStripeServer } from '@/lib/stripe';
import { verifyCheckoutToken } from '@/lib/checkout-token';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  orderId: z.string().uuid(),
  paymentToken: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Nieprawidłowe zamówienie.' }, { status: 400 });

    const stripe = getStripeServer();
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);
    const { data: order, error: orderError } = await admin
      .from('store_orders')
      .select('id, order_number, status, customer_email, total, shipping_cost, stripe_session_id, checkout_token_hash')
      .eq('id', parsed.data.orderId)
      .maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 });
    if (!verifyCheckoutToken(parsed.data.paymentToken, order.checkout_token_hash)) {
      return NextResponse.json({ error: 'Brak dostępu do płatności tego zamówienia.' }, { status: 403 });
    }
    if (order.status !== 'pending') return NextResponse.json({ error: 'To zamówienie nie oczekuje na płatność.' }, { status: 409 });

    if (order.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (existing.url) return NextResponse.json({ url: existing.url });
    }

    const { data: items, error: itemsError } = await admin
      .from('store_order_items')
      .select('name, sku, quantity, unit_price, total')
      .eq('order_id', order.id);
    if (itemsError || !items?.length) return NextResponse.json({ error: 'Zamówienie nie zawiera produktów.' }, { status: 422 });

    const lineItems = items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: 'pln',
        unit_amount: Math.round(Number(item.unit_price) * 100),
        product_data: { name: item.name, metadata: { sku: item.sku } },
      },
    }));

    const shippingCost = Number(order.shipping_cost || 0);
    const calculatedTotalCents = items.reduce(
      (sum, item) => sum + Math.round(Number(item.unit_price) * 100) * item.quantity,
      Math.round(shippingCost * 100)
    );
    const expectedTotalCents = Math.round(Number(order.total) * 100);
    if (calculatedTotalCents !== expectedTotalCents) {
      console.error('Stripe total mismatch:', { orderId: order.id, calculatedTotalCents, expectedTotalCents });
      return NextResponse.json({ error: 'Kwota zamówienia wymaga ponownego przeliczenia.' }, { status: 409 });
    }
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

    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: order.customer_email,
      client_reference_id: order.id,
      metadata: { order_id: order.id, order_number: order.order_number },
      success_url: `${origin}/checkout/sukces?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1&order=${encodeURIComponent(order.id)}`,
      billing_address_collection: 'required',
      locale: 'pl',
    });

    await admin.from('store_orders').update({ stripe_session_id: session.id }).eq('id', order.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Nie udało się przygotować płatności.' }, { status: 500 });
  }
}
