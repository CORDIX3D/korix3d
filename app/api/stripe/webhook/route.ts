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

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await admin.from('store_orders').update({
        status: 'paid',
        stripe_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      }).eq('id', orderId);
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      await admin.rpc('cancel_store_order_and_restore_stock', { p_order_id: orderId });
      await admin.from('store_orders').update({ status: 'cancelled', stripe_session_id: session.id }).eq('id', orderId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Nieprawidłowy webhook Stripe.' }, { status: 400 });
  }
}
