'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Package, ReceiptText, Truck } from 'lucide-react';
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
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  delivery_label?: string;
};

function asAddress(value: unknown): ShippingAddress {
  return value && typeof value === 'object' ? (value as ShippingAddress) : {};
}

export default function StoreOrderDetailsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [items, setItems] = useState<StoreOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('store_orders')
        .select('*')
        .eq('id', params.id)
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
        .select('*')
        .eq('order_id', params.id)
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
  }, [params.id, user]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

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
