'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Cpu,
  Download,
  Loader2,
  PackageCheck,
  RefreshCw,
  Scale,
  ShoppingBag,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Worker = {
  id: string;
  slicer_name: string;
  slicer_version: string | null;
  printer_profile: string | null;
  process_profile: string | null;
  last_seen_at: string;
};

type Calculation = {
  id: string;
  order_id: string;
  file_index: number;
  input_file: { name?: string } | null;
  material_name: string | null;
  color: string | null;
  infill_percent: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  result: { printing_time_seconds?: number; filament_used_grams?: number } | null;
  error_message: string | null;
  requested_at: string;
  orders_3d: { order_number?: string } | { order_number?: string }[] | null;
};

type QuoteOrder = {
  id: string;
  order_number: string;
  status: string;
  material_name: string | null;
  color: string | null;
  infill_percent: number;
  quantity: number;
  priority: string;
  slicing_status: string;
  printing_time_hours: number | null;
  filament_used_grams: number | null;
  net_price: number;
  vat_amount: number;
  final_price: number;
  created_at: string;
};

type StoreOrder = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
  subtotal: number;
  shipping_cost: number;
  vat_amount: number;
  net_total: number;
  total: number;
  payment_state: 'paid' | 'unpaid' | 'refunded';
  tracking_number: string | null;
  created_at: string;
};

type Overview = {
  worker: {
    heartbeat_available: boolean;
    online: boolean;
    active_count: number;
    latest: Worker | null;
  };
  summary: {
    pending_calculations: number;
    processing_calculations: number;
    failed_calculations: number;
    open_production_orders: number;
    unpaid_store_orders: number;
    paid_store_orders: number;
    paid_store_value: number;
  };
  calculations: Calculation[];
  quote_orders: QuoteOrder[];
  store_orders: StoreOrder[];
  checked_at: string;
};

type View = 'production' | 'calculations' | 'shop';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ORDER_STATUS: Record<string, string> = {
  new: 'Nowe', quoted: 'Wyceniono', accepted: 'Zaakceptowane', queued: 'W kolejce',
  printing: 'Drukowanie', post_processing: 'Obróbka', packed: 'Spakowane',
  shipped: 'Wysłane', completed: 'Gotowe', cancelled: 'Anulowane',
};
const CALCULATION_STATUS: Record<string, string> = {
  pending: 'Oczekuje', processing: 'Liczenie', completed: 'Gotowa',
  failed: 'Błąd', cancelled: 'Anulowana',
};
const STORE_STATUS: Record<string, string> = {
  pending: 'Oczekuje na płatność', paid: 'Opłacone', processing: 'W realizacji',
  shipped: 'Wysłane', delivered: 'Dostarczone', cancelled: 'Anulowane', refunded: 'Zwrócone',
};

function money(value: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value || 0);
}

function date(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function duration(seconds: number) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function calculationOrderNumber(calculation: Calculation) {
  const relation = Array.isArray(calculation.orders_3d)
    ? calculation.orders_3d[0]
    : calculation.orders_3d;
  return relation?.order_number || calculation.order_id.slice(0, 8).toUpperCase();
}

function StatusPill({ state, children }: { state: string; children: React.ReactNode }) {
  const positive = ['completed', 'paid', 'delivered', 'shipped'].includes(state);
  const warning = ['pending', 'unpaid', 'quoted', 'queued', 'accepted', 'processing'].includes(state);
  const negative = ['failed', 'cancelled', 'refunded'].includes(state);
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap border-white/10 px-2.5 py-1',
        positive && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning && 'border-amber-500/30 bg-amber-500/10 text-amber-200',
        negative && 'border-red-500/30 bg-red-500/10 text-red-300'
      )}
    >
      {children}
    </Badge>
  );
}

export function ProductionCommandCenter() {
  const [data, setData] = useState<Overview | null>(null);
  const [view, setView] = useState<View>('production');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [standalone, setStandalone] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch('/api/admin/production-overview', { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Nie udało się pobrać danych produkcji.');
      setData(result as Overview);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych produkcji.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches
      || navigatorWithStandalone.standalone === true
    );
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setStandalone(true);
    setInstallPrompt(null);
  };

  const activeQuoteOrders = useMemo(
    () => data?.quote_orders.filter((order) => order.status !== 'cancelled').slice(0, 20) || [],
    [data]
  );

  if (loading && !data) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Uruchamianie centrum produkcji…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <Card className="max-w-md border-red-500/20 bg-red-500/5">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-red-400" />
            <h1 className="mt-3 text-xl font-semibold">Brak połączenia z produkcją</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-5" onClick={() => load()}><RefreshCw className="mr-2 h-4 w-4" />Spróbuj ponownie</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestWorker = data.worker.latest;
  const views: Array<{ id: View; label: string; icon: typeof Box; count: number }> = [
    { id: 'production', label: 'Produkcja 3D', icon: Box, count: data.summary.open_production_orders },
    { id: 'calculations', label: 'Kalkulacje', icon: Cpu, count: data.summary.pending_calculations + data.summary.processing_calculations },
    { id: 'shop', label: 'Zamówienia sklepu', icon: ShoppingBag, count: data.store_orders.length },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-orange-950/30 p-5 shadow-2xl sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-white">KORIX3D CONTROL</Badge>
              <span className="text-xs text-zinc-400">Aktualizacja co 15 sekund</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Centrum <span className="text-gradient">produkcji</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Kalkulacje Creality Print, realizacja zamówień i płatności w jednym widoku.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!standalone && (
              <Button variant="outline" onClick={install} className="border-white/10 bg-black/20">
                <Download className="mr-2 h-4 w-4" />Zainstaluj aplikację
              </Button>
            )}
            <Button onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />Odśwież
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error} Wyświetlane są ostatnie poprawnie pobrane dane.</span>
        </div>
      )}

      <section className={cn(
        'rounded-2xl border p-4 sm:p-5',
        data.worker.online ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'
      )}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('rounded-xl p-2.5', data.worker.online ? 'bg-emerald-500/15' : 'bg-amber-500/15')}>
              {data.worker.online ? <Wifi className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-amber-300" />}
            </div>
            <div>
              <p className="font-semibold">{data.worker.online ? 'Worker Creality Print połączony' : 'Worker Creality Print jest offline'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestWorker
                  ? `${latestWorker.printer_profile || latestWorker.id} · ostatni sygnał ${date(latestWorker.last_seen_at)}`
                  : 'Uruchom worker na komputerze produkcyjnym po zakończeniu instalacji Creality Print.'}
              </p>
            </div>
          </div>
          <Link href="/admin/slicer" className="inline-flex items-center text-sm font-medium text-primary">
            Diagnostyka slicera <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Aktywna produkcja', value: data.summary.open_production_orders, icon: Activity, tone: 'text-orange-400' },
          { label: 'Kalkulacje w kolejce', value: data.summary.pending_calculations + data.summary.processing_calculations, icon: Cpu, tone: 'text-sky-400' },
          { label: 'Opłacone zamówienia', value: data.summary.paid_store_orders, icon: PackageCheck, tone: 'text-emerald-400' },
          { label: 'Wartość opłaconych', value: money(data.summary.paid_store_value), icon: CircleDollarSign, tone: 'text-amber-300' },
        ].map((item) => (
          <Card key={item.label} className="border-white/5 bg-zinc-900/70">
            <CardContent className="p-4 sm:p-5">
              <item.icon className={cn('h-5 w-5', item.tone)} />
              <p className="mt-4 text-2xl font-bold sm:text-3xl">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/5 bg-zinc-900/60 p-2 scrollbar-hide">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={cn(
              'flex min-w-max items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
              view === item.id ? 'bg-primary text-white shadow-glow' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon className="h-4 w-4" />{item.label}
            <span className={cn('rounded-full px-2 py-0.5 text-xs', view === item.id ? 'bg-black/20' : 'bg-white/5')}>{item.count}</span>
          </button>
        ))}
      </nav>

      {view === 'production' && (
        <section className="space-y-3">
          {activeQuoteOrders.length === 0 ? (
            <EmptyState icon={Box} title="Brak zleceń produkcyjnych" description="Nowe zlecenia pojawią się tutaj po wysłaniu kalkulacji przez klienta." />
          ) : activeQuoteOrders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold">{order.order_number}</p>
                    <StatusPill state={order.status}>{ORDER_STATUS[order.status] || order.status}</StatusPill>
                    {order.priority !== 'standard' && <Badge variant="destructive">{order.priority}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {order.material_name || 'Materiał'} · {order.color || 'kolor niepodany'} · wypełnienie {order.infill_percent}% · {order.quantity} szt.
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">Dodano {date(order.created_at)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                  <Metric icon={Clock3} label="Czas" value={order.printing_time_hours ? `${order.printing_time_hours.toFixed(2)} h` : '—'} />
                  <Metric icon={Scale} label="Masa" value={order.filament_used_grams ? `${order.filament_used_grams.toFixed(1)} g` : '—'} />
                  <Metric label="Netto" value={money(order.net_price)} />
                  <Metric label="Brutto" value={money(order.final_price)} accent />
                </div>
              </div>
            </article>
          ))}
          {activeQuoteOrders.length > 0 && <ModuleLink href="/admin/zamowienia" label="Otwórz pełną obsługę zamówień 3D" />}
        </section>
      )}

      {view === 'calculations' && (
        <section className="space-y-3">
          {data.calculations.length === 0 ? (
            <EmptyState icon={Cpu} title="Brak kalkulacji" description="Kalkulacje pojawią się po przesłaniu modeli 3D przez klientów." />
          ) : data.calculations.slice(0, 30).map((calculation) => {
            const seconds = Number(calculation.result?.printing_time_seconds || 0);
            const grams = Number(calculation.result?.filament_used_grams || 0);
            return (
              <article key={calculation.id} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{calculationOrderNumber(calculation)}</p>
                      <StatusPill state={calculation.status}>{CALCULATION_STATUS[calculation.status]}</StatusPill>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {calculation.input_file?.name || `Plik ${calculation.file_index + 1}`} · {calculation.material_name || 'Materiał'} · {calculation.color || 'kolor niepodany'} · {calculation.infill_percent}%
                    </p>
                    {calculation.error_message && <p className="mt-2 text-sm text-red-300">{calculation.error_message}</p>}
                    <p className="mt-2 text-xs text-zinc-500">{date(calculation.requested_at)}</p>
                  </div>
                  <div className="flex gap-3">
                    <Metric icon={Clock3} label="Czas" value={duration(seconds)} />
                    <Metric icon={Scale} label="Masa" value={grams ? `${grams.toFixed(2)} g` : '—'} />
                  </div>
                </div>
              </article>
            );
          })}
          {data.calculations.length > 0 && <ModuleLink href="/admin/slicer" label="Otwórz kolejkę i diagnostykę Creality" />}
        </section>
      )}

      {view === 'shop' && (
        <section className="space-y-3">
          {data.store_orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Brak zamówień sklepu" description="Pierwsze zamówienie pojawi się tutaj automatycznie po checkoutcie." />
          ) : data.store_orders.slice(0, 30).map((order) => (
            <article key={order.id} className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold">{order.order_number}</p>
                    <StatusPill state={order.status}>{STORE_STATUS[order.status] || order.status}</StatusPill>
                    <StatusPill state={order.payment_state}>
                      {order.payment_state === 'paid' ? 'Płatność potwierdzona' : order.payment_state === 'refunded' ? 'Płatność zwrócona' : 'Nieopłacone'}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{order.customer_name || 'Klient sklepu'} · {date(order.created_at)}</p>
                  {order.tracking_number && <p className="mt-1 text-xs text-zinc-500">Przesyłka: {order.tracking_number}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                  <Metric label="Netto" value={money(order.net_total)} />
                  <Metric label="Brutto" value={money(order.total)} accent />
                </div>
              </div>
            </article>
          ))}
          {data.store_orders.length > 0 && <ModuleLink href="/admin/sklep-zamowienia" label="Otwórz pełną obsługę zamówień sklepu" />}
        </section>
      )}

      <footer className="flex flex-col gap-2 border-t border-white/5 pt-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Ostatnia synchronizacja: {date(data.checked_at)}</span>
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Połączenie szyfrowane · dane tylko dla pracowników</span>
      </footer>

      {showInstallHelp && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={() => setShowInstallHelp(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-2xl bg-primary/15 p-3"><Smartphone className="h-6 w-6 text-primary" /></div>
              <button type="button" onClick={() => setShowInstallHelp(false)} className="rounded-full p-2 text-zinc-400 hover:bg-white/5" aria-label="Zamknij"><X className="h-5 w-5" /></button>
            </div>
            <h2 className="mt-5 text-2xl font-bold">Zainstaluj na iPhone</h2>
            <ol className="mt-4 space-y-3 text-sm text-zinc-300">
              <li className="flex gap-3"><span className="font-bold text-primary">1.</span>Otwórz tę stronę w Safari.</li>
              <li className="flex gap-3"><span className="font-bold text-primary">2.</span>Naciśnij ikonę Udostępnij na dolnym pasku.</li>
              <li className="flex gap-3"><span className="font-bold text-primary">3.</span>Wybierz „Do ekranu początkowego”, a potem „Dodaj”.</li>
            </ol>
            <p className="mt-5 rounded-xl bg-white/5 p-3 text-xs text-zinc-400">Po instalacji aplikacja otworzy się bez paska przeglądarki. Logowanie i uprawnienia pozostają takie same jak w panelu KORIX3D.</p>
            <Button className="mt-5 w-full" onClick={() => setShowInstallHelp(false)}>Rozumiem</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent = false }: { icon?: typeof Clock3; label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[110px] rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</p>
      <p className={cn('mt-1 whitespace-nowrap font-bold', accent && 'text-primary')}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Box; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-5 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ModuleLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-center rounded-xl border border-white/5 bg-zinc-900/40 p-3 text-sm font-medium text-primary hover:bg-zinc-900">
      {label}<ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  );
}
