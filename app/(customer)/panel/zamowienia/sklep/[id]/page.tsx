'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CreditCard, Loader2, MapPin, Package, ReceiptText, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatus } from '@/components/customer/order-status';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import type { StoreOrder } from '@/lib/types/database';

type StoreOrderItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type ShippingAddress = {
  name?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  delivery_label?: string;
};

type BillingAddress = {
  invoiceType?: 'individual' | 'company';
  name?: string;
  company?: string;
  nip?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

function asAddress(value: unknown): ShippingAddress {
  return value && typeof value === 'object' ? (value as ShippingAddress) : {};
}

function asBillingAddress(value: unknown): BillingAddress {
  return value && typeof value === 'object' ? (value as BillingAddress) : {};
}

export default function StoreOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { user } = useAuth();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [items, setItems] = useState<StoreOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [resumingPayment, setResumingPayment] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('store_orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (orderError) {
        setError('Nie udało się pobrać szczegółów zamówienia sklepowego.');
        setOrder(null);
        setItems([]);
        return;
      }

      if (!orderData) {
        setError('Zamówienie sklepowe nie istnieje lub nie masz do niego dostępu.');
        setOrder(null);
        setItems([]);
        return;
      }

      const { data: itemData, error: itemsError } = await supabase
        .from('store_order_items')
        .select('id, order_id, product_id, sku, name, quantity, unit_price, total, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (itemsError) {
        setError('Nie udało się pobrać produktów z zamówienia.');
        setOrder(null);
        setItems([]);
        return;
      }

      setOrder(orderData as StoreOrder);
      setItems((itemData || []) as StoreOrderItem[]);
    } catch {
      setError('Nie udało się połączyć z Supabase podczas pobierania zamówienia.');
      setOrder(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  async function resumePayment() {
    setPaymentError('');
    setResumingPayment(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        url?: string;
      };
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Nie udało się wznowić płatności.');
      }
      window.location.assign(result.url);
    } catch (paymentRequestError) {
      setPaymentError(
        paymentRequestError instanceof Error
          ? paymentRequestError.message
          : 'Nie udało się wznowić płatności.'
      );
      setResumingPayment(false);
    }
  }

  if (loading) return <PanelLoading label="Pobieranie zamówienia sklepowego..." />;
  if (error || !order) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" asChild>
          <Link href="/panel/zamowienia"><ArrowLeft className="mr-2 h-4 w-4" />Wróć</Link>
        </Button>
        <PanelError message={error} onRetry={loadOrder} />
      </div>
    );
  }

  const address = asAddress(order.shipping_address);
  const billingAddress = asBillingAddress(order.billing_address);
  const hasBillingAddress = Boolean(
    billingAddress.street || billingAddress.postalCode || billingAddress.city
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link href="/panel/zamowienia"><ArrowLeft className="mr-2 h-4 w-4" />Zamówienia</Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{order.order_number}</h1>
          <p className="mt-1 text-muted-foreground">Zamówienie ze sklepu · {new Date(order.created_at).toLocaleDateString('pl-PL')}</p>
        </div>
        <OrderStatus status={order.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Produkty
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak pozycji zamówienia do wyświetlenia.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku} · {item.quantity} × {Number(item.unit_price).toFixed(2)} zł</p>
                    </div>
                    <p className="font-semibold">{Number(item.total).toFixed(2)} zł</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" />
                Podsumowanie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Produkty</span><span>{Number(order.subtotal || 0).toFixed(2)} zł</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dostawa</span><span>{Number(order.shipping_cost || 0).toFixed(2)} zł</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{Number(order.vat_amount || 0).toFixed(2)} zł</span></div>
              <div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Razem</span><span>{Number(order.total || 0).toFixed(2)} zł</span></div>
              {order.status === 'pending' && (
                <div className="space-y-2 border-t pt-4">
                  <Button className="w-full" onClick={resumePayment} disabled={resumingPayment}>
                    {resumingPayment ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    {resumingPayment ? 'Otwieranie Stripe...' : 'Dokończ płatność'}
                  </Button>
                  {paymentError && (
                    <p className="text-sm text-destructive" role="alert">{paymentError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Dostawa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{address.delivery_label || 'Metoda dostawy'}</p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {address.street || 'Adres do potwierdzenia'}<br />
                  {[address.postalCode, address.city].filter(Boolean).join(' ')}
                </span>
              </p>
              {order.tracking_number && (
                <p className="rounded-lg bg-secondary p-3">
                  Numer przesyłki: <span className="font-semibold">{order.tracking_number}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" />
                Dane fakturowe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hasBillingAddress ? (
                <>
                  <p className="font-medium">
                    {billingAddress.invoiceType === 'company' ? 'Faktura firmowa' : 'Faktura imienna'}
                  </p>
                  {billingAddress.company && <p>{billingAddress.company}</p>}
                  {billingAddress.nip && <p>NIP: {billingAddress.nip}</p>}
                  {billingAddress.name && <p>{billingAddress.name}</p>}
                  <p className="text-muted-foreground">
                    {billingAddress.street}<br />
                    {[billingAddress.postalCode, billingAddress.city].filter(Boolean).join(' ')}
                    {billingAddress.country ? <><br />{billingAddress.country === 'PL' ? 'Polska' : billingAddress.country}</> : null}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Dane fakturowe nie są dostępne dla tego starszego zamówienia.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {order.notes && (
        <Card>
          <CardHeader><CardTitle>Informacje dodatkowe</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
