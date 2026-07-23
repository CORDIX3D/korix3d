'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Package, Printer, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { OrderStatus } from '@/components/customer/order-status';
import { PanelEmpty, PanelError, PanelHeading, PanelLoading } from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import type { Order3D, StoreOrder } from '@/lib/types/database';

type CustomerOrder =
  | {
      id: string;
      type: 'print';
      orderNumber: string;
      status: string;
      createdAt: string;
      href: string;
      title: string;
      description: string;
      amount: number | null;
    }
  | {
      id: string;
      type: 'store';
      orderNumber: string;
      status: string;
      createdAt: string;
      href: string;
      title: string;
      description: string;
      amount: number | null;
    };

function mapPrintOrder(order: Order3D): CustomerOrder {
  return {
    id: order.id,
    type: 'print',
    orderNumber: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    href: `/panel/zamowienia/${order.id}`,
    title: order.material_name || 'Wydruk 3D',
    description: `${order.color || 'Kolor do ustalenia'} · ${order.quantity} szt.`,
    amount: order.final_price === null || order.final_price === undefined ? null : Number(order.final_price),
  };
}

function mapStoreOrder(order: StoreOrder): CustomerOrder {
  return {
    id: order.id,
    type: 'store',
    orderNumber: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    href: `/panel/zamowienia/sklep/${order.id}`,
    title: 'Zamówienie ze sklepu',
    description: `${order.customer_name || order.customer_email} · dostawa ${Number(order.shipping_cost || 0).toFixed(2)} zł`,
    amount: Number(order.total || 0),
  };
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [printOrders, setPrintOrders] = useState<Order3D[]>([]);
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const [printResult, storeResult] = await Promise.all([
        supabase.from('orders_3d').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('store_orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (printResult.error || storeResult.error) {
        setError('Sprawdź połączenie i spróbuj ponownie.');
        setPrintOrders([]);
        setStoreOrders([]);
      } else {
        setPrintOrders((printResult.data ?? []) as Order3D[]);
        setStoreOrders((storeResult.data ?? []) as StoreOrder[]);
      }
    } catch {
      setError('Nie udało się połączyć z Supabase podczas pobierania zamówień.');
      setPrintOrders([]);
      setStoreOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const orders = useMemo(
    () =>
      [...printOrders.map(mapPrintOrder), ...storeOrders.map(mapStoreOrder)].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [printOrders, storeOrders]
  );

  return (
    <div className="space-y-6">
      <PanelHeading title="Zamówienia" description="Historia i aktualny status Twoich zleceń druku 3D oraz zakupów w sklepie." />
      {loading ? (
        <PanelLoading label="Pobieranie zamówień..." />
      ) : error ? (
        <PanelError message={error} onRetry={loadOrders} />
      ) : orders.length === 0 ? (
        <PanelEmpty
          icon={Package}
          title="Nie masz jeszcze zamówień"
          description="Prześlij model 3D do wyceny albo wybierz produkty w sklepie."
          actionLabel="Przejdź do sklepu"
          actionHref="/sklep"
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={`${order.type}-${order.id}`} href={order.href}>
              <Card className="mb-3 transition-colors hover:border-primary/50">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{order.orderNumber}</p>
                      <Badge variant="outline" className="gap-1">
                        {order.type === 'print' ? <Printer className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                        {order.type === 'print' ? 'Druk 3D' : 'Sklep'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.title} · {order.description} · {new Date(order.createdAt).toLocaleDateString('pl-PL')}
                    </p>
                    {order.amount !== null && (
                      <p className="mt-1 text-sm font-medium text-foreground">{order.amount.toFixed(2)} zł</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatus status={order.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
