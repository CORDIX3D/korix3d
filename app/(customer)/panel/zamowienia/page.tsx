'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { Card, CardContent } from '@/components/ui/card';
import { OrderStatus } from '@/components/customer/order-status';
import { PanelEmpty, PanelError, PanelHeading, PanelLoading } from '@/components/customer/panel-state';
import type { Order3D } from '@/lib/types/database';

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const { data, error: queryError } = await supabase.from('orders_3d').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (queryError) {
        setError('Sprawdź połączenie i spróbuj ponownie.');
        setOrders([]);
      } else {
        setOrders((data ?? []) as Order3D[]);
      }
    } catch {
      setError('Nie udało się połączyć z Supabase podczas pobierania zamówień.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  return <div className="space-y-6"><PanelHeading title="Zamówienia" description="Historia i aktualny status Twoich zleceń druku 3D." />
    {loading ? <PanelLoading label="Pobieranie zamówień..." /> : error ? <PanelError message={error} onRetry={loadOrders} /> : orders.length === 0 ? <PanelEmpty icon={Package} title="Nie masz jeszcze zamówień" description="Prześlij model 3D, wybierz materiał i parametry, a przygotujemy indywidualną wycenę." actionLabel="Poproś o wycenę" actionHref="/wycena" /> :
      <div className="space-y-3">{orders.map((order) => <Link key={order.id} href={`/panel/zamowienia/${order.id}`}><Card className="mb-3 transition-colors hover:border-primary/50"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{order.order_number}</p><p className="mt-1 text-sm text-muted-foreground">{order.material_name || 'Materiał do ustalenia'} · {order.quantity} szt. · {new Date(order.created_at).toLocaleDateString('pl-PL')}</p></div><div className="flex items-center gap-3"><OrderStatus status={order.status} /><ChevronRight className="h-4 w-4 text-muted-foreground" /></div></CardContent></Card></Link>)}</div>}
  </div>;
}
