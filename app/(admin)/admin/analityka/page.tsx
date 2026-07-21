'use client';

import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelError } from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';

type Stats = Record<string, number>;

const tables = [
  ['products', 'Produkty'],
  ['orders_3d', 'Zamówienia 3D'],
  ['store_orders', 'Zamówienia sklepu'],
  ['filaments', 'Filamenty'],
  ['materials', 'Materiały'],
  ['contact_submissions', 'Wiadomości'],
  ['blog_posts', 'Blog'],
  ['faq_items', 'FAQ'],
] as const;

export default function Page() {
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const next: Stats = {};

      for (const [table, label] of tables) {
        const { count, error } = await (supabase as any)
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) throw error;
        next[label] = count || 0;
      }

      setStats(next);
    } catch (error) {
      setStats({});
      setLoadError(error instanceof Error ? error.message : 'Nie udało się pobrać danych analitycznych.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analityka</h1>
          <p className="mt-1 text-muted-foreground">Szybki przegląd danych w systemie.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Odśwież
        </Button>
      </div>

      {loadError ? (
        <PanelError message={loadError} onRetry={load} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tables.map(([, label]) => (
            <Card key={label} className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loading ? '...' : stats[label] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
