'use client';

import Link from 'next/link';
import { CreditCard, LockKeyhole, Package, ShoppingCart, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/cart-provider';

export default function CheckoutPage() {
  const { items, subtotal, hydrated } = useCart();

  if (!hydrated) return <div className="flex min-h-[70vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (items.length === 0) return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="max-w-lg text-center">
        <ShoppingCart className="mx-auto mb-5 h-14 w-14 text-muted-foreground" />
        <h1 className="mb-3 text-3xl font-bold">Koszyk jest pusty</h1>
        <p className="mb-7 text-muted-foreground">Dodaj produkty, zanim przejdziesz do składania zamówienia.</p>
        <Button asChild><Link href="/sklep">Wróć do sklepu</Link></Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-primary">Bezpieczne zamówienie</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Finalizacja zamówienia</h1>
        <p className="mt-2 text-muted-foreground">Checkout jest przygotowany. Płatności online uruchomimy po integracji Stripe.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Dane kontaktowe</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="checkout-name">Imię i nazwisko</Label><Input id="checkout-name" autoComplete="name" placeholder="Jan Kowalski" /></div>
              <div className="space-y-2"><Label htmlFor="checkout-email">E-mail</Label><Input id="checkout-email" type="email" autoComplete="email" placeholder="jan@example.com" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="checkout-phone">Telefon</Label><Input id="checkout-phone" type="tel" autoComplete="tel" placeholder="+48 123 456 789" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Adres dostawy</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="checkout-street">Ulica i numer</Label><Input id="checkout-street" autoComplete="street-address" /></div>
              <div className="space-y-2"><Label htmlFor="checkout-postal">Kod pocztowy</Label><Input id="checkout-postal" autoComplete="postal-code" placeholder="00-000" /></div>
              <div className="space-y-2"><Label htmlFor="checkout-city">Miasto</Label><Input id="checkout-city" autoComplete="address-level2" /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Płatność</CardTitle></CardHeader>
            <CardContent><div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Stripe nie jest jeszcze aktywny. Dane karty nie są obecnie zbierane ani przesyłane.</div></CardContent>
          </Card>
        </div>
        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader><CardTitle>Twoje zamówienie</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map((item) => <div key={item.id} className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-muted-foreground" />}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.quantity} × {item.price.toFixed(2)} zł</p></div>
                <p className="text-sm font-semibold">{(item.quantity * item.price).toFixed(2)} zł</p>
              </div>)}
            </div>
            <div className="flex items-center justify-between border-t pt-5"><span>Wartość produktów</span><strong className="text-xl">{subtotal.toFixed(2)} zł</strong></div>
            <p className="text-xs text-muted-foreground">Dostawa zostanie doliczona po uruchomieniu obsługi zamówień.</p>
            <Button className="w-full" disabled><LockKeyhole className="mr-2 h-4 w-4" />Płatności wkrótce</Button>
            <Button asChild variant="outline" className="w-full"><Link href="/kontakt?temat=zamowienie">Zapytaj o realizację</Link></Button>
            <Button asChild variant="ghost" className="w-full"><Link href="/koszyk">Wróć do koszyka</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
