'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Package, ShoppingCart, TicketPercent, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/lib/cart-provider';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import {
  parseDeliveryOptions,
  type DeliveryOption,
} from '@/lib/shipping';
import { isValidPolishNip } from '@/lib/store-order-validation';
import { cartItemsEqual, reconcileCartItems } from '@/lib/cart';
import type { Product } from '@/lib/types/database';
import { normalizeCheckoutError } from '@/lib/checkout-errors';

export default function CheckoutPage() {
  const { items, subtotal, hydrated, replaceCart } = useCart();
  const { profile } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const appliedProfileId = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [deliveryType, setDeliveryType] = useState('');
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [deliveryError, setDeliveryError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [invoiceType, setInvoiceType] = useState<'individual' | 'company'>('individual');
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    amount: number;
    cartSignature: string;
  } | null>(null);
  const selectedDelivery = deliveryOptions.find((option) => option.value === deliveryType);
  const cartSignature = items
    .map((item) => `${item.id}:${item.quantity}`)
    .sort()
    .join('|');
  const activeCoupon = appliedCoupon?.cartSignature === cartSignature ? appliedCoupon : null;
  const discountAmount = Math.min(activeCoupon?.amount || 0, subtotal);
  const total = Math.max(0, subtotal - discountAmount) + (selectedDelivery?.price || 0);

  async function applyCoupon() {
    const normalizedCode = couponCode.trim().toUpperCase();
    setCouponError('');
    setAppliedCoupon(null);
    if (!/^[A-Z0-9_-]{2,40}$/.test(normalizedCode)) {
      setCouponError('Podaj prawidłowy kod rabatowy.');
      return;
    }

    setCouponLoading(true);
    try {
      const response = await fetch('/api/store/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: normalizedCode,
          items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.valid) {
        throw new Error(result.error || 'Nie udało się zastosować kuponu.');
      }
      setCouponCode(String(result.code));
      setAppliedCoupon({
        code: String(result.code),
        amount: Number(result.amount),
        cartSignature,
      });
    } catch (couponSubmitError) {
      setCouponError(
        couponSubmitError instanceof Error
          ? couponSubmitError.message
          : 'Nie udało się zastosować kuponu.'
      );
    } finally {
      setCouponLoading(false);
    }
  }

  const fetchDeliveryOptions = useCallback(async () => {
    setDeliveryLoading(true);
    setDeliveryError('');

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, label, value')
        .eq('category', 'shipping')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const options = parseDeliveryOptions(data || []);
      setDeliveryOptions(options);
      setDeliveryType((current) =>
        options.some((option) => option.value === current) ? current : options[0]?.value || ''
      );
      if (options.length === 0) {
        setDeliveryError('Brak skonfigurowanych metod dostawy. Skontaktuj się z nami przed złożeniem zamówienia.');
      }
    } catch {
      setDeliveryOptions([]);
      setDeliveryType('');
      setDeliveryError('Nie udało się pobrać aktualnych metod dostawy. Spróbuj ponownie.');
    } finally {
      setDeliveryLoading(false);
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
    if (!profile?.id || appliedProfileId.current === profile.id || !formRef.current) return;

    const fillEmpty = (name: string, value: string | null | undefined) => {
      if (!value) return;
      const field = formRef.current?.elements.namedItem(name);
      if (field instanceof HTMLInputElement && !field.value.trim()) field.value = value;
    };

    fillEmpty('name', profile.full_name);
    fillEmpty('email', profile.email);
    fillEmpty('phone', profile.phone);
    fillEmpty('street', profile.address_street);
    fillEmpty('postalCode', profile.address_zip);
    fillEmpty('city', profile.address_city);
    fillEmpty('billingName', profile.full_name);
    fillEmpty('billingCompany', profile.company);
    fillEmpty('billingNip', profile.nip);
    fillEmpty('billingStreet', profile.address_street);
    fillEmpty('billingPostalCode', profile.address_zip);
    fillEmpty('billingCity', profile.address_city);

    if (profile.company || profile.nip) setInvoiceType('company');
    appliedProfileId.current = profile.id;
  }, [profile]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('cancelled') !== '1') return;

    const cancelledOrderId = query.get('order');
    const rawPendingPayment = window.sessionStorage.getItem('korix3d_pending_payment');
    window.history.replaceState({}, '', window.location.pathname);
    if (!rawPendingPayment || !cancelledOrderId) {
      setPaymentNotice('Płatność została przerwana. Koszyk pozostaje bez zmian.');
      return;
    }

    void (async () => {
      let matchedPendingOrder = false;
      try {
        const pendingPayment = JSON.parse(rawPendingPayment) as {
          orderId?: string;
          paymentToken?: string;
        };
        if (pendingPayment.orderId !== cancelledOrderId) {
          setPaymentNotice(
            'Nie udało się potwierdzić, którego zamówienia dotyczy powrót z płatności. Koszyk pozostaje bez zmian.'
          );
          return;
        }
        matchedPendingOrder = true;
        if (!pendingPayment.paymentToken) throw new Error('invalid payment');

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
        if (matchedPendingOrder) {
          window.sessionStorage.removeItem('korix3d_pending_payment');
        }
      }
    })();
  }, []);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (deliveryLoading || deliveryError || !selectedDelivery) {
      setError('Nie można potwierdzić aktualnej metody dostawy. Odśwież listę i spróbuj ponownie.');
      return;
    }

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

    setError('');
    const form = new FormData(event.currentTarget);
    const formValue = (name: string) => String(form.get(name) || '').trim();
    if (invoiceType === 'company' && !isValidPolishNip(formValue('billingNip'))) {
      setError('Podaj prawidłowy 10-cyfrowy NIP firmy.');
      return;
    }

    setSubmitting(true);
    const shippingAddress = {
      street: formValue('street'),
      postalCode: formValue('postalCode'),
      city: formValue('city'),
      country: 'PL' as const,
    };
    const billingAddress = billingSameAsShipping
      ? {
          invoiceType,
          name: formValue('name'),
          company: invoiceType === 'company' ? formValue('billingCompany') : '',
          nip: invoiceType === 'company' ? formValue('billingNip') : '',
          ...shippingAddress,
        }
      : {
          invoiceType,
          name: formValue('billingName'),
          company: invoiceType === 'company' ? formValue('billingCompany') : '',
          nip: invoiceType === 'company' ? formValue('billingNip') : '',
          street: formValue('billingStreet'),
          postalCode: formValue('billingPostalCode'),
          city: formValue('billingCity'),
          country: 'PL' as const,
        };
    let pendingPayment: { orderId: string; paymentToken: string } | null = null;

    try {
      const cartResponse = await fetch('/api/store/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });
      const cartResult = await cartResponse.json().catch(() => ({}));
      if (!cartResponse.ok || !Array.isArray(cartResult.products)) {
        throw new Error(
          cartResult.error || 'Nie można teraz potwierdzić aktualności koszyka.'
        );
      }

      const refreshedItems = reconcileCartItems(
        items,
        cartResult.products as Product[]
      );
      if (!cartItemsEqual(items, refreshedItems)) {
        replaceCart(refreshedItems);
        setAppliedCoupon(null);
        throw new Error(
          'Koszyk został zaktualizowany po zmianie ceny lub dostępności. Sprawdź podsumowanie i zatwierdź ponownie.'
        );
      }

      const response = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: formValue('name'),
            email: formValue('email'),
            phone: formValue('phone'),
          },
          shippingAddress,
          billingAddress,
          deliveryType,
          couponCode: activeCoupon?.code,
          items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(normalizeCheckoutError(result.error));
      }

      if (!result.orderNumber || !result.orderId || !result.paymentToken) {
        throw new Error('Nie udało się bezpiecznie przygotować zamówienia do płatności.');
      }

      pendingPayment = {
        orderId: String(result.orderId),
        paymentToken: String(result.paymentToken),
      };
      const paymentResponse = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingPayment),
      });
      const paymentResult = await paymentResponse.json().catch(() => ({}));

      if (!paymentResponse.ok || !paymentResult.url) {
        throw new Error(
          paymentResult.error === 'stripe_not_configured'
            ? 'Płatności online są chwilowo niedostępne. Spróbuj ponownie później.'
            : paymentResult.error || 'Nie udało się przygotować płatności.'
        );
      }

      window.sessionStorage.setItem('korix3d_pending_payment', JSON.stringify(pendingPayment));
      window.location.assign(paymentResult.url);
      return;
    } catch (submitError) {
      if (pendingPayment) {
        await fetch('/api/stripe/cancel-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingPayment),
        }).catch(() => null);
      }
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
    <form ref={formRef} onSubmit={submitOrder} className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-primary">Bezpieczna płatność online</p>
        <h1 className="text-3xl font-bold sm:text-4xl">Finalizacja zamówienia</h1>
        <p className="mt-2 text-muted-foreground">
          Po sprawdzeniu zamówienia przejdziesz do bezpiecznej płatności obsługiwanej przez Stripe.
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
              <CardTitle>Dane do faktury</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setInvoiceType('individual')}
                  aria-pressed={invoiceType === 'individual'}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    invoiceType === 'individual'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-semibold">Osoba fizyczna</p>
                  <p className="mt-1 text-sm text-muted-foreground">Faktura imienna bez NIP</p>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType('company')}
                  aria-pressed={invoiceType === 'company'}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    invoiceType === 'company'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-semibold">Firma</p>
                  <p className="mt-1 text-sm text-muted-foreground">Faktura firmowa z NIP</p>
                </button>
              </div>

              <p className="text-sm text-muted-foreground">
                Adres jest wymagany dla obu rodzajów faktury. Możesz użyć adresu wysyłki albo podać osobny adres fakturowy.
              </p>

              {invoiceType === 'company' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="checkout-billing-company">Nazwa firmy</Label>
                    <Input
                      id="checkout-billing-company"
                      name="billingCompany"
                      autoComplete="organization"
                      required
                      minLength={2}
                      maxLength={160}
                      defaultValue={profile?.company || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkout-billing-nip">NIP</Label>
                    <Input
                      id="checkout-billing-nip"
                      name="billingNip"
                      inputMode="numeric"
                      required
                      pattern="[0-9]{10}"
                      minLength={10}
                      maxLength={10}
                      placeholder="1234563218"
                      defaultValue={profile?.nip || ''}
                    />
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                <input
                  type="checkbox"
                  checked={billingSameAsShipping}
                  onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  <span className="block font-medium">Adres faktury taki sam jak adres wysyłki</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Odznacz, jeśli faktura ma zawierać inny adres.
                  </span>
                </span>
              </label>

              {!billingSameAsShipping && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="checkout-billing-name">
                      {invoiceType === 'company' ? 'Osoba kontaktowa' : 'Imię i nazwisko'}
                    </Label>
                    <Input
                      id="checkout-billing-name"
                      name="billingName"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                      defaultValue={profile?.full_name || ''}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="checkout-billing-street">Ulica i numer</Label>
                    <Input
                      id="checkout-billing-street"
                      name="billingStreet"
                      autoComplete="billing street-address"
                      required
                      minLength={3}
                      maxLength={160}
                      defaultValue={profile?.address_street || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkout-billing-postal">Kod pocztowy</Label>
                    <Input
                      id="checkout-billing-postal"
                      name="billingPostalCode"
                      autoComplete="billing postal-code"
                      required
                      pattern="[0-9]{2}-[0-9]{3}"
                      maxLength={6}
                      placeholder="00-000"
                      defaultValue={profile?.address_zip || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkout-billing-city">Miasto</Label>
                    <Input
                      id="checkout-billing-city"
                      name="billingCity"
                      autoComplete="billing address-level2"
                      required
                      minLength={2}
                      maxLength={100}
                      defaultValue={profile?.address_city || ''}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground sm:col-span-2">Kraj: Polska</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metoda dostawy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {deliveryError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p>{deliveryError}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={fetchDeliveryOptions} disabled={deliveryLoading}>
                    {deliveryLoading ? 'Pobieranie...' : 'Spróbuj ponownie'}
                  </Button>
                </div>
              )}
              {deliveryLoading && !deliveryError && (
                <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pobieranie aktualnych metod dostawy...
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

            <div className="space-y-2 border-t pt-5">
              <Label htmlFor="checkout-coupon">Kod rabatowy</Label>
              <div className="flex gap-2">
                <Input
                  id="checkout-coupon"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value.toUpperCase());
                    setCouponError('');
                    setAppliedCoupon(null);
                  }}
                  maxLength={40}
                  autoComplete="off"
                  placeholder="Wpisz kod"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                >
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Zastosuj'}
                </Button>
              </div>
              {couponError && <p className="text-sm text-destructive">{couponError}</p>}
              {activeCoupon && (
                <p className="flex items-center gap-2 text-sm text-green-600">
                  <TicketPercent className="h-4 w-4" />
                  Kupon {activeCoupon.code} został zastosowany.
                </p>
              )}
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-green-600">
                <span>Rabat</span>
                <strong>−{discountAmount.toFixed(2)} zł</strong>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-5">
              <span>Razem</span>
              <strong className="text-2xl">{total.toFixed(2)} zł</strong>
            </div>

            <div className="rounded-lg bg-primary/10 p-3 text-xs text-muted-foreground">
              Dane karty podajesz wyłącznie na stronie Stripe. KORIX3D nie zapisuje ani nie przetwarza numeru karty.
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

            <Button type="submit" className="w-full" disabled={submitting || deliveryLoading || !selectedDelivery || Boolean(deliveryError)}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {submitting ? 'Przygotowywanie płatności...' : 'Przejdź do płatności'}
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
