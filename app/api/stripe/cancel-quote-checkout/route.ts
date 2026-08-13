import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { crossSiteRequestResponse, isTrustedMutationRequest } from '@/lib/api/request-security';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import { getStripeServer } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({ orderId: z.string().uuid() });
const HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request)) return crossSiteRequestResponse();
  try {
    const parsed = requestSchema.safeParse(await readJsonObject(request, 8 * 1024));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowa wycena.' }, { status: 400, headers: HEADERS });
    }
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401, headers: HEADERS });
    }
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);
    const { data: quote, error } = await admin
      .from('orders_3d')
      .select('id, user_id, payment_status, stripe_session_id')
      .eq('id', parsed.data.orderId)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!quote) return NextResponse.json({ error: 'Wycena nie istnieje.' }, { status: 404, headers: HEADERS });
    if (quote.payment_status === 'paid') {
      return NextResponse.json({ error: 'Opłaconej wyceny nie można anulować.' }, { status: 409, headers: HEADERS });
    }
    if (quote.stripe_session_id) {
      const stripe = getStripeServer();
      const session = await stripe.checkout.sessions.retrieve(quote.stripe_session_id);
      if (session.payment_status === 'paid' || session.status === 'complete') {
        return NextResponse.json({ error: 'Płatność została już zakończona.' }, { status: 409, headers: HEADERS });
      }
      if (session.status === 'open') await stripe.checkout.sessions.expire(session.id);
    }
    const { data: released, error: releaseError } = await admin.rpc('release_quote_payment_locked', {
      p_order_id: quote.id,
      p_session_id: quote.stripe_session_id,
    });
    if (releaseError) throw releaseError;
    return NextResponse.json({ success: released === true }, { headers: HEADERS });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: HEADERS });
    }
    console.error('Quote checkout cancellation error:', error);
    return NextResponse.json({ error: 'Nie udało się anulować płatności.' }, { status: 500, headers: HEADERS });
  }
}
