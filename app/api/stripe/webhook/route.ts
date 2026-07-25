import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import {
  getStripeServer,
  getStripeWebhookSecret,
  isStripeConfigurationError,
} from '@/lib/stripe';

export const dynamic = 'force-dynamic';
const MAX_WEBHOOK_BYTES = 1024 * 1024;

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Brak podpisu webhooka.' }, { status: 400 });

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Webhook jest zbyt duży.' }, { status: 413 });
  }

  let stripe: Stripe;
  let event: Stripe.Event;
  try {
    stripe = getStripeServer();
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: 'Webhook jest zbyt duży.' }, { status: 413 });
    }
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (error) {
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Webhook Stripe nie jest skonfigurowany.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    console.error('Stripe webhook signature error:', error);
    return NextResponse.json({ error: 'Nieprawidłowy podpis webhooka Stripe.' }, { status: 400 });
  }

  try {
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);

    const supportedEvents = new Set([
      'checkout.session.async_payment_failed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.completed',
      'checkout.session.expired',
    ]);
    if (!supportedEvents.has(event.type)) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (!orderId) return NextResponse.json({ received: true });

    const { data: order, error: orderError } = await admin
      .from('store_orders')
      .select('id, total, status, stripe_session_id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ received: true, ignored: true });
    if (!order.stripe_session_id || order.stripe_session_id !== session.id) {
      console.error('Stripe webhook session mismatch:', {
        orderId,
        receivedSessionId: session.id,
        storedSessionId: order.stripe_session_id,
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const paymentConfirmed =
      event.type === 'checkout.session.async_payment_succeeded' ||
      (event.type === 'checkout.session.completed' && session.payment_status === 'paid');

    if (paymentConfirmed) {
      const expectedAmount = Math.round(Number(order.total) * 100);
      if (session.currency !== 'pln' || session.amount_total !== expectedAmount) {
        console.error('Stripe webhook amount mismatch:', {
          orderId,
          currency: session.currency,
          receivedAmount: session.amount_total,
          expectedAmount,
        });
        return NextResponse.json({ received: true, ignored: true });
      }

      const { data: paidOrders, error: paymentError } = await admin
        .from('store_orders')
        .update({
          status: 'paid',
          checkout_token_hash: null,
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
        })
        .eq('id', order.id)
        .eq('stripe_session_id', session.id)
        .eq('status', 'pending')
        .select('id');
      if (paymentError) throw paymentError;
      if (!paidOrders?.length && order.status !== 'paid') {
        console.error('Stripe paid event ignored because order is no longer pending:', {
          orderId: order.id,
          orderStatus: order.status,
        });
      }
    } else if (event.type === 'checkout.session.completed') {
      const { error: sessionError } = await admin
        .from('store_orders')
        .update({ stripe_session_id: session.id })
        .eq('id', orderId);
      if (sessionError) throw sessionError;
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const { error: cancellationError } = await admin.rpc(
        'cancel_store_order_and_restore_stock',
        { p_order_id: order.id }
      );
      if (cancellationError) throw cancellationError;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Obsługa webhooka jest chwilowo niedostępna.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Nie udało się przetworzyć webhooka Stripe.' },
      { status: 500 }
    );
  }
}
