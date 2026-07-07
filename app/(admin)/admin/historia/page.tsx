'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { AlertCircle, Eye, History, RefreshCw, Search } from 'lucide-react';

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
};

type Actor = { full_name: string | null; email: string | null };

const moduleNames: Record<string, string> = {
  warehouse_items: 'Magazyn',
  filaments: 'Filamenty',
  materials: 'Materiały',
  material_colors: 'Kolory materiałów',
  products: 'Produkty',
  categories: 'Kategorie',
  orders_3d: 'Zamówienia 3D',
  store_orders: 'Zamówienia sklepu',
  settings: 'Ustawienia i dostawa',
  blog_posts: 'Blog',
  faq_items: 'FAQ',
  portfolio_items: 'Portfolio',
  discount_codes: 'Kupony',
  profiles: 'Użytkownicy',
  contact_submissions: 'Wiadomości',
  notifications: 'Powiadomienia',
};

const actionLabels = {
  INSERT: { label: 'Dodano', className: 'border-green-500/30 text-green-400' },
  UPDATE: { label: 'Edytowano', className: 'border-blue-500/30 text-blue-400' },
  DELETE: { label: 'Usunięto', className: 'border-red-500/30 text-red-400' },
};

const ignoredFields = new Set(['updated_at']);

function recordLabel(row: AuditRow) {
  const data = row.new_data || row.old_data || {};
  return String(
    data.name || data.title || data.label || data.order_number || data.sku || data.email || data.key || row.record_id || 'Rekord'
  );
}

function changedFields(row: AuditRow) {
  const before = row.old_data || {};
  const after = row.new_data || {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !ignoredFields.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  return String(value);
}

export default function AdminHistoryPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<Record<string, Actor>>({});
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    const { data, error: historyError } = await (supabase as any)
      .from('admin_audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(300);

    if (historyError) {
      setError('Nie udało się pobrać historii zmian. Sprawdź, czy migracja bazy została zastosowana.');
      setRows([]);
      setLoading(false);
      return;
    }

    const auditRows = (data || []) as AuditRow[];
    setRows(auditRows);

    const actorIds = [...new Set(auditRows.map((row) => row.changed_by).filter(Boolean))] as string[];
    if (actorIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email')
        .in('id', actorIds);
      setActors(Object.fromEntries((profiles || []).map((profile: Actor & { id: string }) => [profile.id, profile])));
    } else {
      setActors({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const modules = useMemo(() => [...new Set(rows.map((row) => row.table_name))].sort(), [rows]);
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const actor = row.changed_by ? actors[row.changed_by] : null;
      const matchesModule = moduleFilter === 'all' || row.table_name === moduleFilter;
      const haystack = [moduleNames[row.table_name], row.table_name, recordLabel(row), actor?.full_name, actor?.email, row.action]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesModule && (!term || haystack.includes(term));
    });
  }, [actors, moduleFilter, rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><History className="h-7 w-7 text-primary" />Historia zmian</h1>
          <p className="mt-1 text-muted-foreground">Edycje magazynu i pozostałych modułów wraz z informacją, kto je wykonał.</p>
        </div>
        <Button variant="outline" onClick={loadHistory} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Odśwież</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Zarejestrowane zmiany</p><p className="mt-1 text-3xl font-bold">{rows.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Moduły</p><p className="mt-1 text-3xl font-bold">{modules.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Widoczne po filtrze</p><p className="mt-1 text-3xl font-bold">{visibleRows.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rejestr operacji</CardTitle>
          <div className="grid gap-3 pt-2 sm:grid-cols-[1fr_240px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj osoby, modułu lub rekordu..." className="pl-9" /></div>
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="h-10 rounded-md border border-border bg-secondary px-3 text-sm">
              <option value="all">Wszystkie moduły</option>
              {modules.map((module) => <option key={module} value={module}>{moduleNames[module] || module}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center py-10 text-center"><AlertCircle className="mb-3 h-9 w-9 text-destructive" /><p className="max-w-xl text-muted-foreground">{error}</p><Button className="mt-4" variant="outline" onClick={loadHistory}>Spróbuj ponownie</Button></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-3 pr-4">Data</th><th className="py-3 pr-4">Kto</th><th className="py-3 pr-4">Moduł</th><th className="py-3 pr-4">Operacja</th><th className="py-3 pr-4">Rekord</th><th className="py-3 text-right">Szczegóły</th></tr></thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const actor = row.changed_by ? actors[row.changed_by] : null;
                    const action = actionLabels[row.action];
                    return <tr key={row.id} className="border-b border-border/60"><td className="whitespace-nowrap py-3 pr-4">{new Date(row.changed_at).toLocaleString('pl-PL')}</td><td className="py-3 pr-4"><p className="font-medium">{actor?.full_name || actor?.email || 'System'}</p>{actor?.full_name && actor.email && <p className="text-xs text-muted-foreground">{actor.email}</p>}</td><td className="py-3 pr-4">{moduleNames[row.table_name] || row.table_name}</td><td className="py-3 pr-4"><Badge variant="outline" className={action.className}>{action.label}</Badge></td><td className="max-w-[240px] truncate py-3 pr-4">{recordLabel(row)}</td><td className="py-3 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(row)}><Eye className="h-4 w-4" /></Button></td></tr>;
                  })}
                  {!loading && visibleRows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Brak zapisanych zmian.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Szczegóły zmiany</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">{changedFields(selected).map((field) => <div key={field} className="rounded-lg border p-4"><p className="mb-2 text-sm font-semibold">{field}</p><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs text-muted-foreground">Przed</p><pre className="whitespace-pre-wrap break-words rounded bg-secondary p-3 text-xs">{formatValue(selected.old_data?.[field])}</pre></div><div><p className="mb-1 text-xs text-muted-foreground">Po</p><pre className="whitespace-pre-wrap break-words rounded bg-secondary p-3 text-xs">{formatValue(selected.new_data?.[field])}</pre></div></div></div>)}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

