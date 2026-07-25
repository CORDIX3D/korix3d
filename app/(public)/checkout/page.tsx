'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Package, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/cart-provider';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { supabase } from '@/lib/supabase/client';
import {
  DEFAULT_DELIVERY_OPTIONS,
  IGNORED_SHIPPING_SETTING_KEYS,
  type DeliveryOption,
} from '@/lib/shipping';

function normalizeCheckoutError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('niedostępny') || lower.includes('koszyk')) {
    return 'Jeden z produktów nie jest już dostępny w wybranej ilości. Wróć do koszyka, odśwież pozycje i spróbuj ponownie.';
  }

  if (lower.includes('dane kontaktowe') || lower.includes('adres')) {
    return 'Sprawdź dane kontaktowe i adres dostawy. Kod pocztowy powinien mieć format 00-000.';
  }

  return message || 'Nie udało się złożyć zamówienia. Spróbuj ponownie.';
}

export default function CheckoutPage() {
  const { items, subtotal, hydrated, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>(DEFAULT_DELIVERY_OPTIONS);
  const [deliveryType, setDeliveryType] = useState(DEFAULT_DELIVERY_OPTIONS[0].value);
  const [deliveryError, setDeliveryError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const selectedDelivery = deliveryOptions.find((option) => option.value === deliveryType) || deliveryOptions[0];
  const total = subtotal + (selectedDelivery?.price || 0);

  const fetchDeliveryOptions = useCallback(async () => {
    setDeliveryError('');

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, label, value')
        .eq('category', 'shipping')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const options = (data || [])
        .filter((setting: { key: string | null }) => setting.key && !IGNORED_SHIPPING_SETTING_KEYS.has(setting.key))
        .map((setting: { key: string; label: string | null; value: string | number | null }) => {
          const price = Number(String(setting.value ?? '0').replace(',', '.'));
          return {
            value: setting.key.replace(/_price$/, ''),
            label: setting.label || setting.key.replace(/_/g, ' '),
            price: Number.isFinite(price) ? price : 0,
          };
        });

      setDeliveryOptions(options.length > 0 ? options : DEFAULT_DELIVERY_OPTIONS);
    } catch {
      setDeliveryOptions(DEFAULT_DELIVERY_OPTIONS);
      setDeliveryError('Nie udało się pobrać aktualnych metod dostawy. Pokazujemy domyślne opcje.');
    }
  }, []);

  useEffect(() => {
    fetchDeliveryOptions();
  }, [fetchDeliveryOptions]);

  useEffect(() => {
    if (deliveryOptions.length > 0 && !deliveryOptions.some((option) => option.value === deliveryType)) {
      setDeliveryType(deliveryOptions[0].value);
    }
  }, [deliveryOptions, deliveryType]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('cancelled') !== '1') return;

    const rawPendingPayment = window.sessionStorage.getItem('korix3d_pending_payment');
    window.history.replaceState({}, '', window.location.pathname);
    if (!rawPendingPayment) {
      setPaymentNotice('Płatność została przerwana. Koszyk pozostaje bez zmian.');
      return;
    }

    void (async () => {
      try {
        const pendingPayment = JSON.parse(rawPendingPayment) as {
          orderId?: string;
          paymentToken?: string;
        };
        if (!pendingPayment.orderId || !pendingPayment.paymentToken) throw new Error('invalid payment');

        const response = await fetch('/api/stripe/cancel-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingPayment),
        });
        if (!response.ok) throw new Error('cancellation failed');
        setPaymentNotice('Płatność została anulowana, a produkty wróciły do dostępnego stanu.');
      } catch {
        setPaymentNotice('Płatność została przerwana. Jeśli nie możesz spróbować ponownie, skontaktuj się z nami.');
      } finally {
        window.sessionStorage.removeItem('korix3d_pending_payment');
      }
    })();
  }, []);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const hasInvalidCartItem = items.some(
      (item) =>
        !item.id ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > item.stockQuantity
    );
    if (hasInvalidCartItem) {
      setError('Koszyk zawiera nieprawidłową pozycję. Wróć do koszyka, usuń ją i dodaj produkt ponownie.');
      return;
    }

    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: form.get('name'),
            email: form.get('email'),
            phone: form.get('phone'),
          },
          shippingAddress: {
            street: form.get('street'),
            postalCode: form.get('postalCode'),
            city: form.get('city'),
            country: 'PL',
          },
          deliveryType,
          items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(normalizeCheckoutError(result.error));
      }

      if (!result.orderNumber) {
        throw new Error('Zamówienie zostało zapisane, ale nie udało się odczytać jego numeru. Skontaktuj się z nami, jeśli nie otrzymasz potwierdzenia.');
      }

      if (result.orderId && result.paymentToken) {
        const paymentResponse = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: result.orderId, paymentToken: result.paymentToken }),
        });
        const paymentResult = await paymentResponse.json().catch(() => ({}));

        if (paymentResponse.ok && paymentResult.url) {
          window.sessionStorage.setItem(
            'korix3d_pending_payment',
            JSON.stringify({ orderId: result.orderId, paymentToken: result.paymentToken })
          );
          window.location.assign(paymentResult.url);
          return;
        }

        if (paymentResult.error !== 'stripe_not_configured') {
          throw new Error(paymentResult.error || 'Nie udało się przygotować płatności.');
        }
      }

      setOrderNumber(String(result.orderNumber));
      clearCart();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? normalizeCheckoutError(submitError.message)
          : 'Nie udało się złożyć zamówienia. Spróbuj ponownie.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Ładowanie koszyka" />
      </div>
    );
  }

  if (orderNumber) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-xl text-center">
          <CardContent className="p-8">
            <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-green-500" />
            <h1 className="mb-3 text-3xl font-bold">Zamówienie zostało przyjęte</h1>
            <p className="mb-2 text-muted-foreground">Numer zamówienia:</p>
            <p className="mb-5 text-xl font-semibold">{orderNumber}</p>
            <p className="mb-7 text-sm text-muted-foreground">
              Potwierdzimy dostępność produktów oraz sposób płatności wiadomością e-mail.
            </p>
            <Button asChild>
              <Link href="/sklep">Wróć do sklepu</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="max-w-lg text-center">
          <ShoppingCart className="mx-auto mb-5 h-14 w-14 text-muted-foreground" />
          <h1 className="mb-3 text-3xl font-bold">Koszyk jest pusty</h1>
          <p className="mb-7 text-muted-foreground">Dodaj produkty, zanim przejdziesz do składania zamówienia.</p>
          <Button asChild>
            <Link href="/sklep">Wróć do sklepu</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submitOrder} className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-primary">Zamówienie bez płatności online</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Finalizacja zamówienia</h1>
        <p className="mt-2 text-muted-foreground">
          Po wysłaniu zamówienia potwierdzimy dostawę i płatność e-mailem.
        </p>
      </div>

      {paymentNotice && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
          {paymentNotice}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dane kontaktowe</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="checkout-name">Imię i nazwisko</Label>
                <Input id="checkout-name" name="name" autoComplete="name" required minLength={2} placeholder="Jan Kowalski" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-email">E-mail</Label>
                <Input id="checkout-email" name="email" type="email" autoComplete="email" required placeholder="jan@example.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="checkout-phone">Telefon</Label>
                <Input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  minLength={7}
                  pattern="[+0-9\s()-]{7,30}"
                  placeholder="+48 123 456 789"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Adres dostawy
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="checkout-street">Ulica i numer</Label>
                <Input id="checkout-street" name="street" autoComplete="street-address" required minLength={3} placeholder="ul. Przykładowa 12/3" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-postal">Kod pocztowy</Label>
                <Input id="checkout-postal" name="postalCode" autoComplete="postal-code" required pattern="[0-9]{2}-[0-9]{3}" placeholder="00-000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-city">Miasto</Label>
                <Input id="checkout-city" name="city" autoComplete="address-level2" required minLength={2} placeholder="Warszawa" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metoda dostawy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deliveryError && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-muted-foreground">
                  {deliveryError}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {deliveryOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDeliveryType(option.value)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      deliveryType === option.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.price === 0 ? 'Gratis' : `${option.price.toFixed(2)} zł`}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Twoje zamówienie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                    {item.image ? (
                      <OptimizedImage src={item.image} alt={item.name} className="h-full w-full object-cover" sizes="56px" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {item.price.toFixed(2)} zł
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{(item.quantity * item.price).toFixed(2)} zł</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t pt-5">
              <span>Wartość produktów</span>
              <strong className="text-xl">{subtotal.toFixed(2)} zł</strong>
            </div>

            <div className="flex items-center justify-between">
              <span>Dostawa</span>
              <strong>{selectedDelivery?.price === 0 ? 'Gratis' : `${(selectedDelivery?.price || 0).toFixed(2)} zł`}</strong>
            </div>

            <div className="flex items-center justify-between border-t pt-5">
              <span>Razem</span>
              <strong className="text-2xl">{total.toFixed(2)} zł</strong>
            </div>

            <div className="rounded-lg bg-primary/10 p-3 text-xs text-muted-foreground">
              Dane do płatności potwierdzimy przed realizacją. Nie pobieramy teraz danych karty.
            </div>

            {error && (
              <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>{error}</p>
                    {error.toLowerCase().includes('koszyka') && (
                      <Link href="/koszyk" className="mt-2 inline-block font-medium underline">
                        Wróć do koszyka
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {submitting ? 'Zapisywanie...' : 'Złóż zamówienie'}
            </Button>
            {submitting ? (
              <Button type="button" variant="ghost" className="w-full" disabled>
                Wróć do koszyka
              </Button>
            ) : (
              <Button asChild variant="ghost" className="w-full">
                <Link href="/koszyk">Wróć do koszyka</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
