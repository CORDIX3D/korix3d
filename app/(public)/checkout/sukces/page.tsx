import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStripeServer } from '@/lib/stripe';
import { CheckoutSuccessCart } from '@/components/shop/checkout-success-cart';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

type PaymentState = 'paid' | 'processing' | 'invalid';
type PaymentDetails = {
  state: PaymentState;
  orderNumber: string | null;
  hasCustomerAccount: boolean;
};

async function getPaymentState(sessionId: string | undefined): Promise<PaymentDetails> {
  const invalid: PaymentDetails = {
    state: 'invalid',
    orderNumber: null,
    hasCustomerAccount: false,
  };
  if (!sessionId || !sessionId.startsWith('cs_')) return invalid;

  try {
    const session = await getStripeServer().checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (!orderId) return invalid;

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey);
    const { data: order, error } = await admin
      .from('store_orders')
      .select('id, order_number, user_id, status, total, stripe_session_id')
      .eq('id', orderId)
      .maybeSingle();

    if (
      error ||
      !order ||
      order.stripe_session_id !== session.id ||
      order.status === 'cancelled' ||
      session.currency !== 'pln' ||
      session.amount_total !== Math.round(Number(order.total) * 100)
    ) {
      return invalid;
    }

    const details = {
      orderNumber: order.order_number || null,
      hasCustomerAccount: Boolean(order.user_id),
    };

    if (session.payment_status === 'paid') return { state: 'paid', ...details };
    if (session.status === 'complete' && session.payment_status === 'unpaid') {
      return { state: 'processing', ...details };
    }
    return invalid;
  } catch {
    return invalid;
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const payment = await getPaymentState(sessionId);
  const { state } = payment;
  const paid = state === 'paid';
  const processing = state === 'processing';

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <CheckoutSuccessCart clear={paid || processing} />
      <Card className="w-full max-w-xl text-center">
        <CardContent className="p-8">
          {paid ? (
            <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-green-500" />
          ) : processing ? (
            <Clock3 className="mx-auto mb-5 h-16 w-16 text-amber-500" />
          ) : (
            <AlertCircle className="mx-auto mb-5 h-16 w-16 text-destructive" />
          )}
          <h1 className="mb-3 text-3xl font-bold">
            {paid
              ? 'Płatność została przyjęta'
              : processing
                ? 'Płatność jest przetwarzana'
                : 'Nie udało się potwierdzić płatności'}
          </h1>
          <p className="mb-7 text-muted-foreground">
            {paid
              ? 'Zamówienie zostało zapisane. Zalogowani klienci mogą śledzić jego status i powiadomienia w panelu klienta.'
              : processing
                ? 'Status zamówienia zostanie zaktualizowany automatycznie po potwierdzeniu przez Stripe.'
                : 'Sprawdź historię zamówień. Jeśli płatność została pobrana, skontaktuj się z nami.'}
          </p>
          {payment.orderNumber && (
            <p className="mb-7 rounded-lg bg-secondary px-4 py-3 text-sm">
              Numer zamówienia: <strong>{payment.orderNumber}</strong>
            </p>
          )}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href={payment.hasCustomerAccount ? '/panel/zamowienia' : '/sklep'}>
                {payment.hasCustomerAccount ? 'Przejdź do zamówień' : 'Wróć do sklepu'}
              </Link>
            </Button>
            {!paid && (
              <Button asChild variant="outline">
                <Link href="/kontakt">Skontaktuj się</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
