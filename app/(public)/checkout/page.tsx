'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Package, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/cart-provider';
import { OptimizedImage } from '@/components/ui/optimized-image';

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

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const hasInvalidCartItem = items.some(
      (item) =>
        !item.id ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
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
              Potwierdzimy dostępność, koszt dostawy i sposób płatności wiadomością e-mail.
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

            <div className="rounded-lg bg-primary/10 p-3 text-xs text-muted-foreground">
              Koszt dostawy i dane do płatności potwierdzimy przed realizacją. Nie pobieramy teraz danych karty.
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
