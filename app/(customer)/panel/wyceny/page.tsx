'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { Card, CardContent } from '@/components/ui/card';
import { OrderStatus } from '@/components/customer/order-status';
import { PanelEmpty, PanelError, PanelHeading, PanelLoading } from '@/components/customer/panel-state';
import type { Order3D } from '@/lib/types/database';

export default function QuotesPage() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Order3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadQuotes = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const { data, error: queryError } = await supabase.from('orders_3d').select('*').eq('user_id', user.id).in('status', ['new', 'quoted']).order('created_at', { ascending: false });
      if (queryError) {
        setError('Nie udało się pobrać wycen. Spróbuj ponownie.');
        setQuotes([]);
      } else {
        setQuotes((data ?? []) as Order3D[]);
      }
    } catch {
      setError('Nie udało się połączyć z Supabase podczas pobierania wycen.');
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => { void loadQuotes(); }, [loadQuotes]);
  return <div className="space-y-6"><PanelHeading title="Wyceny" description="Tutaj znajdziesz oczekujące oraz przygotowane wyceny." />
    {loading ? <PanelLoading /> : error ? <PanelError message={error} onRetry={loadQuotes} /> : quotes.length === 0 ? <PanelEmpty icon={FileText} title="Brak aktywnych wycen" description="Nie masz obecnie żadnej wyceny oczekującej na przygotowanie lub akceptację." actionLabel="Utwórz nową wycenę" actionHref="/wycena" /> : <div className="space-y-3">{quotes.map((quote) => <Link key={quote.id} href={`/panel/zamowienia/${quote.id}`}><Card className="mb-3 transition-colors hover:border-primary/50"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{quote.order_number}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(quote.created_at).toLocaleDateString('pl-PL')}{quote.final_price != null ? ` · ${Number(quote.final_price).toFixed(2)} zł` : ''}</p></div><div className="flex items-center gap-3"><OrderStatus status={quote.status} /><ChevronRight className="h-4 w-4 text-muted-foreground" /></div></CardContent></Card></Link>)}</div>}
  </div>;
}
