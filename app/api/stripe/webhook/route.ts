import { NextRequest, NextResponse } from 'next/server';
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
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
import { getStripeSessionBinding } from '@/lib/stripe-session';
import {
  isExpectedStripeAmount,
  isFullStripeRefund,
  shouldReleaseStockAfterStripeEvent,
} from '@/lib/stripe-webhook';
import { sendOrderUpdateEmailSafely } from '@/lib/email/smtp';

export const dynamic = 'force-dynamic';

const MAX_WEBHOOK_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPPORTED_EVENTS = new Set<Stripe.Event.Type>([
  'charge.refunded',
  'checkout.session.async_payment_failed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
]);

type AdminClient = SupabaseClient;
type EventOutcome = {
  status: 'processed' | 'ignored';
  orderId: string | null;
};

function validOrderId(value: string | null | undefined) {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function stripeObjectId(event: Stripe.Event) {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === 'string' ? object.id.slice(0, 255) : null;
}

function paymentIntentId(
  value: string | Stripe.PaymentIntent | null
) {
  if (typeof value === 'string') return value;
  return value?.id || null;
}

function safeProcessingError(error: unknown) {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
  ) {
    return `database_${error.code}`;
  }
  return error instanceof Error ? error.name : 'unknown_error';
}

async function finishEvent(
  admin: AdminClient,
  eventId: string,
  outcome: EventOutcome
) {
  const { data, error } = await admin.rpc('finish_stripe_webhook_event', {
    p_event_id: eventId,
    p_status: outcome.status,
    p_order_id: outcome.orderId,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Stripe event lease could not be completed.');
}

async function getOrderById(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from('store_orders')
    .select('id, order_number, user_id, customer_email, customer_name, total, status, stripe_session_id, stripe_payment_intent_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getQuoteById(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from('orders_3d')
    .select('id, order_number, user_id, final_price, status, payment_status, stripe_session_id, stripe_payment_intent_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function quoteOrderIdFromMetadata(
  metadata: Stripe.Metadata | null,
  clientReferenceId?: string | null
) {
  if (metadata?.order_type !== 'quote') return null;
  return validOrderId(metadata.quote_order_id || clientReferenceId);
}

async function processQuoteCheckoutSession(
  admin: AdminClient,
  event: Stripe.Event
): Promise<EventOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = quoteOrderIdFromMetadata(
    session.metadata,
    session.client_reference_id
  );
  if (!orderId) return { status: 'ignored', orderId: null };

  const quote = await getQuoteById(admin, orderId);
  if (!quote) return { status: 'ignored', orderId: null };

  const sessionBinding = getStripeSessionBinding(
    quote.stripe_session_id,
    session.id
  );
  if (sessionBinding === 'mismatch') {
    console.error('Stripe quote webhook session mismatch.', { orderId });
    return { status: 'ignored', orderId: null };
  }

  const paymentConfirmed =
    event.type === 'checkout.session.async_payment_succeeded'
    || (event.type === 'checkout.session.completed' && session.payment_status === 'paid');

  if (paymentConfirmed) {
    if (!isExpectedStripeAmount(
      session.currency,
      session.amount_total,
      Number(quote.final_price)
    )) {
      console.error('Stripe quote webhook amount mismatch.', { orderId });
      return { status: 'ignored', orderId: null };
    }

    const intentId = paymentIntentId(session.payment_intent);
    if (!intentId) throw new Error('Paid quote session has no payment intent.');
    const { data: completed, error } = await admin.rpc(
      'complete_quote_payment_locked',
      {
        p_order_id: quote.id,
        p_session_id: session.id,
        p_payment_intent_id: intentId,
        p_amount_cents: session.amount_total,
      }
    );
    if (error) throw error;
    if (!completed) {
      throw new Error('Paid Stripe quote session could not be committed.');
    }
    const { data: quoteUser } = await admin.auth.admin.getUserById(quote.user_id);
    if (quote.payment_status !== 'paid' && quoteUser.user?.email) {
      await sendOrderUpdateEmailSafely({
        to: quoteUser.user.email,
        customerName: typeof quoteUser.user.user_metadata?.full_name === 'string' ? quoteUser.user.user_metadata.full_name : null,
        orderNumber: quote.order_number,
        orderType: 'quote',
        event: 'paid',
        totalGross: Number(quote.final_price),
        panelUrl: `https://korix3d.pl/panel/zamowienia/${quote.id}`,
      });
    }
    // stripe_webhook_events.order_id points to store_orders, not orders_3d.
    return { status: 'processed', orderId: null };
  }

  if (event.type === 'checkout.session.completed') {
    if (sessionBinding === 'unbound') {
      const { error } = await admin
        .from('orders_3d')
        .update({
          payment_status: 'pending',
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId(session.payment_intent),
        })
        .eq('id', quote.id)
        .eq('status', 'accepted')
        .is('stripe_session_id', null);
      if (error) throw error;
    }
    return { status: 'processed', orderId: null };
  }

  if (shouldReleaseStockAfterStripeEvent(event.type)) {
    const { data: released, error } = await admin.rpc(
      'release_quote_payment_locked',
      { p_order_id: quote.id, p_session_id: session.id }
    );
    if (error) throw error;
    if (!released) return { status: 'ignored', orderId: null };
  }
  return { status: 'processed', orderId: null };
}

async function processCheckoutSession(
  admin: AdminClient,
  event: Stripe.Event
): Promise<EventOutcome> {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = validOrderId(
    session.metadata?.order_id || session.client_reference_id
  );
  if (!orderId) return { status: 'ignored', orderId: null };

  const order = await getOrderById(admin, orderId);
  if (!order) return { status: 'ignored', orderId };

  const sessionBinding = getStripeSessionBinding(
    order.stripe_session_id,
    session.id
  );
  if (sessionBinding === 'mismatch') {
    console.error('Stripe webhook session mismatch.', { orderId });
    return { status: 'ignored', orderId };
  }

  const paymentConfirmed =
    event.type === 'checkout.session.async_payment_succeeded'
    || (event.type === 'checkout.session.completed' && session.payment_status === 'paid');

  if (paymentConfirmed) {
    if (!isExpectedStripeAmount(session.currency, session.amount_total, Number(order.total))) {
      console.error('Stripe webhook amount mismatch.', { orderId });
      return { status: 'ignored', orderId };
    }

    const intentId = paymentIntentId(session.payment_intent);
    const paymentUpdate = admin
      .from('store_orders')
      .update({
        status: 'paid',
        stripe_session_id: session.id,
        checkout_token_hash: null,
        stripe_payment_intent_id: intentId,
      })
      .eq('id', order.id)
      .eq('status', 'pending');
    const { data: paidOrders, error: paymentError } = sessionBinding === 'unbound'
      ? await paymentUpdate.is('stripe_session_id', null).select('id')
      : await paymentUpdate.eq('stripe_session_id', session.id).select('id');
    if (paymentError) throw paymentError;

    if (!paidOrders?.length) {
      const currentOrder = await getOrderById(admin, order.id);
      if (
        currentOrder?.status !== 'paid'
        || currentOrder.stripe_session_id !== session.id
        || (intentId && currentOrder.stripe_payment_intent_id !== intentId)
      ) {
        throw new Error('Paid Stripe session could not be committed to the order.');
      }
    }
    if (paidOrders?.length) {
      await sendOrderUpdateEmailSafely({
        to: order.customer_email,
        customerName: order.customer_name,
        orderNumber: order.order_number,
        orderType: 'store',
        event: 'paid',
        totalGross: Number(order.total),
        panelUrl: order.user_id
          ? `https://korix3d.pl/panel/zamowienia/sklep/${order.id}`
          : 'https://korix3d.pl/logowanie',
      });
    }
    return { status: 'processed', orderId };
  }

  if (event.type === 'checkout.session.completed') {
    if (sessionBinding === 'unbound') {
      const { error } = await admin
        .from('store_orders')
        .update({
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId(session.payment_intent),
        })
        .eq('id', orderId)
        .eq('status', 'pending')
        .is('stripe_session_id', null);
      if (error) throw error;
    }
    return { status: 'processed', orderId };
  }

  if (shouldReleaseStockAfterStripeEvent(event.type)) {
    const { error: cancellationError } = await admin.rpc(
      'cancel_store_order_and_restore_stock_locked',
      { p_order_id: order.id }
    );
    if (cancellationError) throw cancellationError;
  }
  return { status: 'processed', orderId };
}

async function processPaymentFailure(
  admin: AdminClient,
  event: Stripe.Event
): Promise<EventOutcome> {
  const intent = event.data.object as Stripe.PaymentIntent;
  const quoteOrderId = quoteOrderIdFromMetadata(intent.metadata);
  if (quoteOrderId) {
    const quote = await getQuoteById(admin, quoteOrderId);
    if (!quote) return { status: 'ignored', orderId: null };
    if (
      !isExpectedStripeAmount(intent.currency, intent.amount, Number(quote.final_price))
      || (quote.stripe_payment_intent_id && quote.stripe_payment_intent_id !== intent.id)
    ) {
      console.error('Stripe failed quote payment binding mismatch.', { orderId: quoteOrderId });
      return { status: 'ignored', orderId: null };
    }
    if (quote.status === 'accepted' && !quote.stripe_payment_intent_id) {
      const { error } = await admin
        .from('orders_3d')
        .update({ stripe_payment_intent_id: intent.id })
        .eq('id', quote.id)
        .eq('status', 'accepted')
        .is('stripe_payment_intent_id', null);
      if (error) throw error;
    }
    return { status: 'processed', orderId: null };
  }
  const orderId = validOrderId(intent.metadata?.order_id);
  if (!orderId) return { status: 'ignored', orderId: null };

  const order = await getOrderById(admin, orderId);
  if (!order) return { status: 'ignored', orderId };
  if (
    !isExpectedStripeAmount(intent.currency, intent.amount, Number(order.total))
    || (order.stripe_payment_intent_id && order.stripe_payment_intent_id !== intent.id)
  ) {
    console.error('Stripe failed payment binding mismatch.', { orderId });
    return { status: 'ignored', orderId };
  }

  // A failed card attempt can be retried in the same open Checkout Session.
  // Stock is released only by the definitive Checkout expiration/failure event.
  if (order.status === 'pending' && !order.stripe_payment_intent_id) {
    const { error } = await admin
      .from('store_orders')
      .update({ stripe_payment_intent_id: intent.id })
      .eq('id', order.id)
      .eq('status', 'pending')
      .is('stripe_payment_intent_id', null);
    if (error) throw error;
  }
  return { status: 'processed', orderId };
}

async function processRefund(
  admin: AdminClient,
  event: Stripe.Event
): Promise<EventOutcome> {
  const charge = event.data.object as Stripe.Charge;
  const intentId = paymentIntentId(charge.payment_intent);
  if (!intentId) return { status: 'ignored', orderId: null };

  const { data: quote, error: quoteError } = await admin
    .from('orders_3d')
    .select('id, final_price, payment_status, stripe_payment_intent_id')
    .eq('stripe_payment_intent_id', intentId)
    .maybeSingle();
  if (quoteError) throw quoteError;
  if (quote) {
    if (!isExpectedStripeAmount(charge.currency, charge.amount, Number(quote.final_price))) {
      console.error('Stripe quote refund amount mismatch.', { orderId: quote.id });
      return { status: 'ignored', orderId: null };
    }
    if (!isFullStripeRefund({
      refunded: charge.refunded,
      amount: charge.amount,
      amountRefunded: charge.amount_refunded,
    })) {
      return { status: 'processed', orderId: null };
    }
    const { data: refunded, error } = await admin.rpc(
      'refund_quote_payment_locked',
      { p_order_id: quote.id }
    );
    if (error) throw error;
    return { status: refunded ? 'processed' : 'ignored', orderId: null };
  }

  const { data: order, error } = await admin
    .from('store_orders')
    .select('id, total, status, stripe_payment_intent_id')
    .eq('stripe_payment_intent_id', intentId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return { status: 'ignored', orderId: null };

  if (!isExpectedStripeAmount(charge.currency, charge.amount, Number(order.total))) {
    console.error('Stripe refund amount mismatch.', { orderId: order.id });
    return { status: 'ignored', orderId: order.id };
  }

  if (!isFullStripeRefund({
    refunded: charge.refunded,
    amount: charge.amount,
    amountRefunded: charge.amount_refunded,
  })) {
    // Partial refunds require an explicit accounting workflow and do not close the order.
    return { status: 'processed', orderId: order.id };
  }

  const { data: refunded, error: refundError } = await admin.rpc(
    'refund_store_order_and_restore_stock_locked',
    { p_order_id: order.id }
  );
  if (refundError) throw refundError;
  if (!refunded) {
    return { status: 'ignored', orderId: order.id };
  }
  return { status: 'processed', orderId: order.id };
}

async function processEvent(
  admin: AdminClient,
  event: Stripe.Event
): Promise<EventOutcome> {
  if (event.type === 'payment_intent.payment_failed') {
    return processPaymentFailure(admin, event);
  }
  if (event.type === 'charge.refunded') {
    return processRefund(admin, event);
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.order_type === 'quote') {
    return processQuoteCheckoutSession(admin, event);
  }
  return processCheckoutSession(admin, event);
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Brak podpisu webhooka.' }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Webhook jest zbyt duży.' }, { status: 413 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json({ error: 'Webhook jest zbyt duży.' }, { status: 413 });
    }
    event = getStripeServer().webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Webhook Stripe nie jest skonfigurowany.' },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
      );
    }
    console.error('Stripe webhook signature validation failed.');
    return NextResponse.json(
      { error: 'Nieprawidłowy podpis webhooka Stripe.' },
      { status: 400 }
    );
  }

  if (!SUPPORTED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  let admin: AdminClient | null = null;
  let claimed = false;
  try {
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    admin = createSupabaseClient(url, serviceRoleKey);
    const { data, error } = await admin.rpc('claim_stripe_webhook_event', {
      p_event_id: event.id,
      p_event_type: event.type,
      p_object_id: stripeObjectId(event),
    });
    if (error) throw error;
    claimed = data === true;
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const outcome = await processEvent(admin, event);
    await finishEvent(admin, event.id, outcome);
    return NextResponse.json({
      received: true,
      ignored: outcome.status === 'ignored',
    });
  } catch (error) {
    if (admin && claimed) {
      const { error: failureError } = await admin.rpc('fail_stripe_webhook_event', {
        p_event_id: event.id,
        p_error: safeProcessingError(error),
      });
      if (failureError) {
        console.error('Stripe webhook failure status could not be saved.');
      }
    }

    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Obsługa webhooka jest chwilowo niedostępna.' },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
      );
    }

    console.error('Stripe webhook processing failed.', {
      eventId: event.id,
      eventType: event.type,
      reason: safeProcessingError(error),
    });
    return NextResponse.json(
      { error: 'Nie udało się przetworzyć webhooka Stripe.' },
      { status: 500 }
    );
  }
}
