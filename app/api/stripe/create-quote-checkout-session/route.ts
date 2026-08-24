import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { z } from 'zod';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import {
  crossSiteRequestResponse,
  isTrustedMutationRequest,
} from '@/lib/api/request-security';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import {
  getStripeCheckoutOrigin,
  getStripeServer,
  getStripeWebhookSecret,
  isStripeConfigurationError,
} from '@/lib/stripe';
import { sendPaymentLinkEmailSafely } from '@/lib/email/smtp';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({ orderId: z.string().uuid() });
const HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request)) return crossSiteRequestResponse();

  let reservedOrderId: string | null = null;
  try {
    const parsed = requestSchema.safeParse(await readJsonObject(request, 8 * 1024));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowa wycena.' }, { status: 400, headers: HEADERS });
    }

    const stripe = getStripeServer();
    getStripeWebhookSecret();
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError && (authError.status || 0) >= 500) throw authError;
    if (!auth.user?.email) {
      return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401, headers: HEADERS });
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);
    const selectQuote = () => admin
      .from('orders_3d')
      .select('id, order_number, user_id, status, payment_status, final_price, vat_amount, material_name, color, quantity, delivery_type, stripe_session_id, stripe_payment_intent_id, updated_at')
      .eq('id', parsed.data.orderId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    let { data: quote, error: quoteError } = await selectQuote();
    if (quoteError) throw quoteError;
    if (!quote) {
      return NextResponse.json({ error: 'Wycena nie istnieje.' }, { status: 404, headers: HEADERS });
    }
    if (quote.payment_status === 'paid' || quote.status === 'queued') {
      return NextResponse.json({
        paid: true,
        redirect: `/panel/zamowienia/${quote.id}?payment=success`,
      }, { headers: HEADERS });
    }

    if (quote.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(quote.stripe_session_id);
      if (existing.status === 'open' && existing.url) {
        return NextResponse.json({ url: existing.url }, { headers: HEADERS });
      }
      if (existing.status === 'complete') {
        const intentId = typeof existing.payment_intent === 'string'
          ? existing.payment_intent
          : existing.payment_intent?.id;
        const expectedAmount = Math.round(Number(quote.final_price || 0) * 100);
        if (
          existing.payment_status === 'paid'
          && existing.currency === 'pln'
          && existing.amount_total === expectedAmount
          && intentId
        ) {
          const { data: completed, error: completionError } = await admin.rpc(
            'complete_quote_payment_locked',
            {
              p_order_id: quote.id,
              p_session_id: existing.id,
              p_payment_intent_id: intentId,
              p_amount_cents: expectedAmount,
            }
          );
          if (completionError) throw completionError;
          if (completed) {
            return NextResponse.json({
              paid: true,
              redirect: `/panel/zamowienia/${quote.id}?payment=success`,
            }, { headers: HEADERS });
          }
        }
        return NextResponse.json(
          { error: 'Ta płatność jest nadal przetwarzana. Odśwież stronę za chwilę.' },
          { status: 409, headers: HEADERS }
        );
      }
      const { error: releaseError } = await admin.rpc('release_quote_payment_locked', {
        p_order_id: quote.id,
        p_session_id: existing.id,
      });
      if (releaseError) throw releaseError;
      ({ data: quote, error: quoteError } = await selectQuote());
      if (quoteError || !quote) throw quoteError || new Error('Released quote disappeared.');
    }

    if (quote.status === 'quoted') {
      const { data: accepted, error: acceptError } = await supabase.rpc('accept_order_quote', {
        p_order_id: quote.id,
      });
      if (acceptError) {
        const message = String(acceptError.message || '');
        if (acceptError.code === '23514' && message.includes('insufficient filament stock')) {
          return NextResponse.json(
            { error: 'Wybrany filament nie wystarcza już na realizację. Skontaktujemy się w sprawie zamiennika.' },
            { status: 409, headers: HEADERS }
          );
        }
        throw acceptError;
      }
      if (!accepted) {
        return NextResponse.json(
          { error: 'Wycena nie jest już gotowa do płatności.' },
          { status: 409, headers: HEADERS }
        );
      }
      reservedOrderId = quote.id;
      ({ data: quote, error: quoteError } = await selectQuote());
      if (quoteError || !quote) throw quoteError || new Error('Accepted quote disappeared.');
    }

    if (quote.status !== 'accepted' || Number(quote.final_price || 0) <= 0) {
      return NextResponse.json(
        { error: 'Wycena nie oczekuje na płatność.' },
        { status: 409, headers: HEADERS }
      );
    }

    const amountCents = Math.round(Number(quote.final_price) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 100) {
      throw new Error('Invalid quote payment amount.');
    }

    const origin = getStripeCheckoutOrigin(request.nextUrl.origin);
    const metadata = {
      order_type: 'quote',
      quote_order_id: quote.id,
      order_number: quote.order_number,
      currency: 'pln',
      vat_amount: Number(quote.vat_amount || 0).toFixed(2),
      prices_include_tax: 'true',
    };
    const description = [
      quote.material_name || 'Wydruk 3D',
      quote.color || null,
      `${quote.quantity} szt.`,
    ].filter(Boolean).join(' · ').slice(0, 500);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'pln',
          unit_amount: amountCents,
          product_data: {
            name: `Projekt 3D ${quote.order_number}`,
            description,
          },
        },
      }],
      customer_email: auth.user.email,
      client_reference_id: quote.id,
      metadata,
      payment_intent_data: { metadata },
      automatic_tax: { enabled: false },
      billing_address_collection: 'required',
      success_url: `${origin}/panel/zamowienia/${quote.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/panel/zamowienia/${quote.id}?payment=cancelled`,
      locale: 'pl',
      expires_at: Math.floor(Date.now() / 1000) + 35 * 60,
    };
    if (quote.delivery_type !== 'pickup') {
      sessionParams.shipping_address_collection = { allowed_countries: ['PL'] };
    }

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey: `korix3d-quote-${quote.id}-${Date.parse(quote.updated_at)}`,
    });

    const { data: saved, error: saveError } = await admin
      .from('orders_3d')
      .update({ payment_status: 'pending', stripe_session_id: session.id })
      .eq('id', quote.id)
      .eq('status', 'accepted')
      .in('payment_status', ['unpaid', 'failed'])
      .is('stripe_session_id', null)
      .select('id')
      .maybeSingle();
    if (saveError || !saved) {
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
      await admin.rpc('release_quote_payment_locked', {
        p_order_id: quote.id,
        p_session_id: null,
      });
      if (saveError) throw saveError;
      return NextResponse.json(
        { error: 'Stan wyceny zmienił się podczas przygotowywania płatności.' },
        { status: 409, headers: HEADERS }
      );
    }

    reservedOrderId = null;
    if (session.url) {
      const customerName = typeof auth.user.user_metadata?.full_name === 'string'
        ? auth.user.user_metadata.full_name
        : null;
      await sendPaymentLinkEmailSafely({
        to: auth.user.email,
        customerName,
        orderNumber: quote.order_number,
        paymentUrl: session.url,
        totalGross: Number(quote.final_price),
        expiresAt: new Date(session.expires_at * 1000),
        orderType: 'quote',
      });
    }
    return NextResponse.json({ url: session.url }, { headers: HEADERS });
  } catch (error) {
    if (reservedOrderId) {
      try {
        const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
        const admin = createSupabaseClient(url, serviceRoleKey);
        await admin.rpc('release_quote_payment_locked', {
          p_order_id: reservedOrderId,
          p_session_id: null,
        });
      } catch {
        console.error('Quote payment reservation cleanup failed.');
      }
    }
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: HEADERS });
    }
    if (isStripeConfigurationError(error)) {
      return NextResponse.json({ error: 'stripe_not_configured' }, {
        status: 503,
        headers: { ...HEADERS, 'Retry-After': '60' },
      });
    }
    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json({ error: 'Płatności są chwilowo niedostępne.' }, {
        status: 503,
        headers: { ...HEADERS, 'Retry-After': '60' },
      });
    }
    console.error('Quote Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Nie udało się przygotować płatności za wycenę.' },
      { status: 500, headers: HEADERS }
    );
  }
}
