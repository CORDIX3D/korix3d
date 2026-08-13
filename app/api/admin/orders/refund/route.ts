import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import {
  crossSiteRequestResponse,
  isTrustedMutationRequest,
} from '@/lib/api/request-security';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';
import { getStripeServer, isStripeConfigurationError } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({ orderId: z.string().uuid() });
const HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request)) return crossSiteRequestResponse();

  try {
    const auth = await requireAdminApiContext();
    if (auth.response) return auth.response;

    const parsed = requestSchema.safeParse(await readJsonObject(request, 8 * 1024));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator wyceny.' },
        { status: 400, headers: HEADERS }
      );
    }

    const { data: order, error } = await auth.context.adminClient
      .from('orders_3d')
      .select('id, order_number, payment_status, stripe_payment_intent_id')
      .eq('id', parsed.data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      return NextResponse.json(
        { error: 'Wycena nie istnieje.' },
        { status: 404, headers: HEADERS }
      );
    }
    if (order.payment_status === 'refunded') {
      return NextResponse.json({ success: true, alreadyRefunded: true }, { headers: HEADERS });
    }
    if (order.payment_status !== 'paid' || !order.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'Można zwrócić tylko w pełni opłaconą wycenę.' },
        { status: 409, headers: HEADERS }
      );
    }

    const refund = await getStripeServer().refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id,
        reason: 'requested_by_customer',
        metadata: {
          order_type: 'quote',
          quote_order_id: order.id,
          order_number: order.order_number,
          initiated_by: auth.context.user.id,
        },
      },
      { idempotencyKey: `korix3d-quote-refund-${order.id}` }
    );

    return NextResponse.json(
      { success: true, refundId: refund.id, status: refund.status },
      { status: 202, headers: HEADERS }
    );
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: HEADERS }
      );
    }
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Stripe jest chwilowo niedostępny.' },
        { status: 503, headers: { ...HEADERS, 'Retry-After': '60' } }
      );
    }
    if (isSupabaseConfigurationError(error)) return adminApiUnavailableResponse();

    console.error('Admin quote refund error:', error);
    return NextResponse.json(
      { error: 'Nie udało się wykonać pełnego zwrotu.' },
      { status: 500, headers: HEADERS }
    );
  }
}
