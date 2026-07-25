import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { getStripeServer, getStripeWebhookSecret } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Brak podpisu webhooka.' }, { status: 400 });

  try {
    const stripe = getStripeServer();
    const event = stripe.webhooks.constructEvent(await request.text(), signature, getStripeWebhookSecret());
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);

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

      const { error: paymentError } = await admin.from('store_orders').update({
        status: 'paid',
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      }).eq('id', order.id).eq('stripe_session_id', session.id);
      if (paymentError) throw paymentError;
    } else if (event.type === 'checkout.session.completed') {
      const { error: sessionError } = await admin
        .from('store_orders')
        .update({ stripe_session_id: session.id })
        .eq('id', orderId);
      if (sessionError) throw sessionError;
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const { error: cancellationError } = await admin.rpc('cancel_store_order_and_restore_stock', {
        p_order_id: order.id,
      });
      if (cancellationError) throw cancellationError;
      const { error: sessionError } = await admin
        .from('store_orders')
        .update({ status: 'cancelled', stripe_session_id: session.id })
        .eq('id', orderId);
      if (sessionError) throw sessionError;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Nieprawidłowy webhook Stripe.' }, { status: 400 });
  }
}
