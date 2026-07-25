import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStripeServer } from '@/lib/stripe';
import { CheckoutSuccessCart } from '@/components/shop/checkout-success-cart';

export const dynamic = 'force-dynamic';

type PaymentState = 'paid' | 'processing' | 'invalid';

async function getPaymentState(sessionId: string | undefined): Promise<PaymentState> {
  if (!sessionId || !sessionId.startsWith('cs_')) return 'invalid';

  try {
    const session = await getStripeServer().checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') return 'paid';
    if (session.status === 'open' || session.payment_status === 'unpaid') return 'processing';
    return 'invalid';
  } catch {
    return 'invalid';
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const state = await getPaymentState(searchParams.session_id);
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
              ? 'Potwierdzenie zamówienia wyślemy na podany adres e-mail.'
              : processing
                ? 'Status zamówienia zostanie zaktualizowany automatycznie po potwierdzeniu przez Stripe.'
                : 'Sprawdź historię zamówień. Jeśli płatność została pobrana, skontaktuj się z nami.'}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/panel/zamowienia">Przejdź do zamówień</Link>
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
