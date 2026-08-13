'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, CreditCard, FileBox, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatus } from '@/components/customer/order-status';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';
import type { Order3D } from '@/lib/types/database';
import { OrderFileDownload, StoredOrderFile } from '@/components/customer/order-file-download';
import { CUSTOMER_ORDER_3D_COLUMNS } from '@/lib/customer-order';

type OrderFile = StoredOrderFile;

const progressSteps = [
  { key: 'new', label: 'Zgłoszenie' },
  { key: 'quoted', label: 'Wycena' },
  { key: 'accepted', label: 'Akceptacja' },
  { key: 'printing', label: 'Produkcja' },
  { key: 'shipped', label: 'Wysyłka' },
  { key: 'completed', label: 'Zakończone' },
] as const;

const statusProgress: Record<string, number> = {
  new: 0,
  quoted: 1,
  accepted: 2,
  queued: 2,
  printing: 3,
  post_processing: 3,
  packed: 3,
  shipped: 4,
  completed: 5,
};

const slicingStatusLabels: Record<string, string> = {
  not_started: 'Oczekuje na pliki',
  pending: 'W kolejce Creality Print',
  processing: 'Creality Print analizuje model',
  completed: 'Analiza Creality Print zakończona',
  partial_failed: 'Część plików wymaga sprawdzenia',
  failed: 'Analiza automatyczna nie powiodła się',
};

export default function OrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const paymentReturnHandled = useRef(false);

  const loadOrder = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const { data, error: queryError } = await supabase.from('orders_3d').select(CUSTOMER_ORDER_3D_COLUMNS).eq('id', orderId).eq('user_id', user.id).maybeSingle();
      if (queryError) {
        setError('Nie udało się pobrać szczegółów zamówienia.');
        setOrder(null);
      } else if (!data) {
        setError('Zamówienie nie istnieje lub nie masz do niego dostępu.');
        setOrder(null);
      } else {
        setOrder(data as Order3D);
      }
    } catch {
      setError('Nie udało się połączyć z Supabase podczas pobierania zamówienia.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  useEffect(() => {
    if (!user || paymentReturnHandled.current) return;
    const payment = new URLSearchParams(window.location.search).get('payment');
    if (!payment) return;
    paymentReturnHandled.current = true;

    const clearPaymentQuery = () => {
      window.history.replaceState(null, '', window.location.pathname);
    };

    if (payment === 'cancelled') {
      void (async () => {
        try {
          const response = await fetch('/api/stripe/cancel-quote-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok) throw new Error(result?.error || 'Nie udało się anulować płatności.');
          toast.info('Płatność została anulowana', {
            description: 'Wycena nadal jest dostępna i możesz zapłacić później.',
          });
        } catch (cancelError) {
          toast.error(cancelError instanceof Error ? cancelError.message : 'Nie udało się anulować płatności.');
        } finally {
          clearPaymentQuery();
          await loadOrder();
        }
      })();
      return;
    }

    if (payment === 'success') {
      toast.success('Płatność została przyjęta', {
        description: 'Potwierdzamy ją automatycznie przez Stripe.',
      });
      clearPaymentQuery();
      const firstRefresh = window.setTimeout(() => void loadOrder(), 1200);
      const secondRefresh = window.setTimeout(() => void loadOrder(), 3500);
      return () => {
        window.clearTimeout(firstRefresh);
        window.clearTimeout(secondRefresh);
      };
    }
  }, [loadOrder, orderId, user]);

  const startPayment = async () => {
    if (!order || paying || order.payment_status === 'paid') return;
    setPaying(true);
    try {
      const response = await fetch('/api/stripe/create-quote-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const message = result?.error === 'stripe_not_configured'
          ? 'Płatności są chwilowo niedostępne. Spróbuj ponownie później.'
          : result?.error || 'Nie udało się otworzyć płatności.';
        toast.error(message);
        return;
      }

      if (result?.url) {
        window.location.assign(result.url);
        return;
      }
      if (result?.paid && result?.redirect) {
        window.location.assign(result.redirect);
        return;
      }
      toast.error('Stripe nie zwrócił adresu płatności.');
    } catch {
      toast.error('Nie udało się połączyć ze Stripe.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <PanelLoading label="Pobieranie szczegółów..." />;
  if (error || !order) return <div className="space-y-5"><Button variant="ghost" asChild><Link href="/panel/zamowienia"><ArrowLeft className="mr-2 h-4 w-4" />Wróć</Link></Button><PanelError message={error} onRetry={loadOrder} /></div>;
  const files = Array.isArray(order.files) ? order.files as OrderFile[] : [];

  return <div className="space-y-6"><Button variant="ghost" asChild><Link href="/panel/zamowienia"><ArrowLeft className="mr-2 h-4 w-4" />Zamówienia</Link></Button>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold sm:text-3xl">{order.order_number}</h1><p className="mt-1 text-muted-foreground">Utworzono {new Date(order.created_at).toLocaleDateString('pl-PL')}</p></div><OrderStatus status={order.status} /></div>
    {order.status !== 'cancelled' && (
      <Card>
        <CardHeader><CardTitle>Postęp zamówienia</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {progressSteps.map((step, index) => {
              const reached = index <= (statusProgress[order.status] ?? 0);
              return (
                <li key={step.key} className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${reached ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {reached ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={reached ? 'text-sm font-medium text-foreground' : 'text-sm text-muted-foreground'}>{step.label}</span>
                </li>
              );
            })}
          </ol>
          {order.tracking_number && (
            <p className="mt-5 rounded-lg bg-secondary p-3 text-sm">
              Numer przesyłki: <span className="font-semibold">{order.tracking_number}</span>
            </p>
          )}
        </CardContent>
      </Card>
    )}
    {order.payment_status === 'paid' && <Card className="border-green-500/30 bg-green-500/10"><CardContent className="flex items-center gap-3 p-5"><CheckCircle2 className="h-6 w-6 text-green-500" /><div><p className="font-semibold">Płatność potwierdzona</p><p className="text-sm text-muted-foreground">Zlecenie zostało przekazane do realizacji.</p></div></CardContent></Card>}
    {(order.status === 'quoted' || (order.status === 'accepted' && order.payment_status !== 'paid')) && <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted-foreground">Cena końcowa brutto</p><p className="text-2xl font-bold">{Number(order.final_price || 0).toFixed(2)} zł</p><p className="mt-1 text-xs text-muted-foreground">Bezpieczna płatność w oknie Stripe. Adres rozliczeniowy jest wymagany.</p></div><Button onClick={startPayment} disabled={paying || Number(order.final_price || 0) <= 0}>{paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Otwieranie płatności...</> : <><CreditCard className="mr-2 h-4 w-4" />{order.status === 'accepted' ? 'Wznów płatność' : 'Zapłać przez Stripe'}</>}</Button></CardContent></Card>}
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Parametry</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Materiał</p><p className="font-medium">{order.material_name || 'Do ustalenia'}</p></div><div><p className="text-muted-foreground">Kolor</p><p className="font-medium">{order.color || 'Do ustalenia'}</p></div><div><p className="text-muted-foreground">Liczba sztuk</p><p className="font-medium">{order.quantity}</p></div><div><p className="text-muted-foreground">Wypełnienie</p><p className="font-medium">{order.infill_percent}%</p></div><div className="col-span-2"><p className="text-muted-foreground">Analiza pliku</p><p className="font-medium">{slicingStatusLabels[order.slicing_status] || 'Oczekuje'}</p></div>{order.slicing_status === 'completed' && <><div><p className="text-muted-foreground">Czas druku</p><p className="font-medium">{Number(order.printing_time_hours || 0).toFixed(2)} h</p></div><div><p className="text-muted-foreground">Zużycie filamentu</p><p className="font-medium">{Number(order.filament_used_grams || 0).toFixed(2)} g</p></div></>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileBox className="h-5 w-5 text-primary" />Pliki ({files.length})</CardTitle></CardHeader><CardContent>{files.length === 0 ? <p className="text-sm text-muted-foreground">Brak plików przypisanych do zamówienia.</p> : <div className="space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-secondary p-3 text-sm"><div><p className="font-medium">{file.name || `Plik ${index + 1}`}</p>{file.size && <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}</div><OrderFileDownload file={file} /></div>)}</div>}</CardContent></Card></div>
    {order.notes && <Card><CardHeader><CardTitle>Informacje dodatkowe</CardTitle></CardHeader><CardContent><p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p></CardContent></Card>}
  </div>;
}
