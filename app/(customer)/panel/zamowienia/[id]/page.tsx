'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FileBox, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderStatus } from '@/components/customer/order-status';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';
import type { Order3D } from '@/lib/types/database';
import { OrderFileDownload, StoredOrderFile } from '@/components/customer/order-file-download';

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

export default function OrderDetailsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const { data, error: queryError } = await supabase.from('orders_3d').select('*').eq('id', params.id).eq('user_id', user.id).maybeSingle();
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
  }, [params.id, user]);

  useEffect(() => { void loadOrder(); }, [loadOrder]);

  const acceptQuote = async () => {
    if (!order || order.status !== 'quoted' || accepting) return;
    setAccepting(true);
    try {
      const { data: accepted, error: updateError } = await supabase.rpc('accept_order_quote', { p_order_id: order.id });
      if (updateError || !accepted) toast.error('Nie udało się zaakceptować wyceny');
      else { setOrder({ ...order, status: 'accepted' }); toast.success('Wycena została zaakceptowana'); }
    } catch {
      toast.error('Nie udało się połączyć z Supabase podczas akceptowania wyceny');
    } finally {
      setAccepting(false);
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
    {order.status === 'quoted' && <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-muted-foreground">Przygotowana wycena</p><p className="text-2xl font-bold">{Number(order.final_price || 0).toFixed(2)} zł</p></div><Button onClick={acceptQuote} disabled={accepting}>{accepting ? 'Akceptowanie...' : <><CheckCircle2 className="mr-2 h-4 w-4" />Akceptuję wycenę</>}</Button></CardContent></Card>}
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Parametry</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Materiał</p><p className="font-medium">{order.material_name || 'Do ustalenia'}</p></div><div><p className="text-muted-foreground">Kolor</p><p className="font-medium">{order.color || 'Do ustalenia'}</p></div><div><p className="text-muted-foreground">Liczba sztuk</p><p className="font-medium">{order.quantity}</p></div><div><p className="text-muted-foreground">Warstwa</p><p className="font-medium">{order.layer_height ? `${order.layer_height} mm` : 'Do ustalenia'}</p></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileBox className="h-5 w-5 text-primary" />Pliki ({files.length})</CardTitle></CardHeader><CardContent>{files.length === 0 ? <p className="text-sm text-muted-foreground">Brak plików przypisanych do zamówienia.</p> : <div className="space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-secondary p-3 text-sm"><div><p className="font-medium">{file.name || `Plik ${index + 1}`}</p>{file.size && <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}</div><OrderFileDownload file={file} /></div>)}</div>}</CardContent></Card></div>
    {order.notes && <Card><CardHeader><CardTitle>Informacje dodatkowe</CardTitle></CardHeader><CardContent><p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p></CardContent></Card>}
  </div>;
}
