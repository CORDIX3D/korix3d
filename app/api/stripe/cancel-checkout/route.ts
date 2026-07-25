import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyCheckoutToken } from '@/lib/checkout-token';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { getStripeServer } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  orderId: z.string().uuid(),
  paymentToken: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane płatności.' }, { status: 400 });
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);
    const { data: order, error: orderError } = await admin
      .from('store_orders')
      .select('id, status, stripe_session_id, checkout_token_hash')
      .eq('id', parsed.data.orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Zamówienie nie istnieje.' }, { status: 404 });
    }
    if (!verifyCheckoutToken(parsed.data.paymentToken, order.checkout_token_hash)) {
      return NextResponse.json({ error: 'Brak dostępu do tego zamówienia.' }, { status: 403 });
    }
    if (order.status === 'cancelled') return NextResponse.json({ cancelled: true });
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Zamówienie nie może zostać anulowane.' }, { status: 409 });
    }

    if (order.stripe_session_id) {
      const stripe = getStripeServer();
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (session.payment_status === 'paid' || session.status === 'complete') {
        return NextResponse.json({ error: 'Płatność została już zakończona.' }, { status: 409 });
      }
      if (session.status === 'open') {
        await stripe.checkout.sessions.expire(session.id);
      }
    }

    const { data: cancelled, error: cancellationError } = await admin.rpc(
      'cancel_store_order_and_restore_stock',
      { p_order_id: order.id }
    );
    if (cancellationError) throw cancellationError;

    return NextResponse.json({ cancelled: Boolean(cancelled) });
  } catch (error) {
    console.error('Stripe checkout cancellation error:', error);
    return NextResponse.json({ error: 'Nie udało się anulować płatności.' }, { status: 500 });
  }
}
