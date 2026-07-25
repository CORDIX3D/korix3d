'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Cpu, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';

type SlicerJob = {
  id: string;
  order_id: string;
  file_index: number;
  input_file: { name?: string } | null;
  material_name: string | null;
  color: string | null;
  infill_percent: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempt_count: number;
  worker_id: string | null;
  slicer_name: string | null;
  slicer_version: string | null;
  result: {
    printing_time_seconds?: number;
    filament_used_grams?: number;
  } | null;
  error_message: string | null;
  requested_at: string;
  orders_3d: { order_number?: string } | { order_number?: string }[] | null;
};

type SlicerResponse = {
  configured: boolean;
  counts: Record<string, number>;
  jobs: SlicerJob[];
};

const statusLabels: Record<SlicerJob['status'], string> = {
  pending: 'Oczekuje',
  processing: 'Przetwarzanie',
  completed: 'Gotowe',
  failed: 'BĹ‚Ä…d',
  cancelled: 'Anulowane',
};

function orderNumber(job: SlicerJob) {
  const relation = Array.isArray(job.orders_3d) ? job.orders_3d[0] : job.orders_3d;
  return relation?.order_number || job.order_id.slice(0, 8).toUpperCase();
}

export default function AdminSlicerPage() {
  const [data, setData] = useState<SlicerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingId, setRetryingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/slicer', { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Nie udaĹ‚o siÄ™ pobraÄ‡ kolejki slicera.');
      setData(result as SlicerResponse);
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof Error ? loadError.message : 'Nie udaĹ‚o siÄ™ pobraÄ‡ kolejki slicera.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (jobId: string) => {
    if (retryingId) return;
    setRetryingId(jobId);
    try {
      const response = await fetch('/api/admin/slicer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', job_id: jobId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Nie udaĹ‚o siÄ™ ponowiÄ‡ zadania.');
      toast.success('Zadanie wrĂłciĹ‚o do kolejki');
      await load();
    } catch (retryError) {
      toast.error('Nie udaĹ‚o siÄ™ ponowiÄ‡ zadania', {
        description: retryError instanceof Error ? retryError.message : undefined,
      });
    } finally {
      setRetryingId('');
    }
  };

  if (loading) return <PanelLoading label="Pobieranie kolejki Creality Print..." />;
  if (error || !data) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Slicer Creality Print</h1>
          <p className="mt-1 text-muted-foreground">
            Automatyczna analiza czasu druku i zuĹĽycia filamentu na zdalnym workerze.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          OdĹ›wieĹĽ
        </Button>
      </div>

      <Card className={data.configured ? 'border-green-500/30' : 'border-amber-500/30'}>
        <CardContent className="flex gap-3 p-5">
          {data.configured ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          )}
          <div>
            <p className="font-semibold">
              {data.configured ? 'PoĹ‚Ä…czenie API jest skonfigurowane' : 'Brakuje tokenu zdalnego workera'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.configured
                ? 'Zadania mogÄ… byÄ‡ pobierane przez serwer z uruchomionym Creality Print.'
                : 'Dodaj CREALITY_SLICER_WORKER_TOKEN w Netlify i ten sam token na serwerze slicera.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Oczekuje', data.counts.pending || 0],
          ['Przetwarzanie', data.counts.processing || 0],
          ['Gotowe', data.counts.completed || 0],
          ['BĹ‚Ä™dy', data.counts.failed || 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Ostatnie zadania
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Kolejka jest pusta. Zadanie pojawi siÄ™ po wysĹ‚aniu nowej wyceny z plikiem 3D.
            </div>
          ) : (
            <div className="space-y-3">
              {data.jobs.map((job) => {
                const seconds = Number(job.result?.printing_time_seconds || 0);
                const grams = Number(job.result?.filament_used_grams || 0);
                return (
                  <div key={job.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{orderNumber(job)}</p>
                          <Badge variant="outline">{statusLabels[job.status]}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {job.input_file?.name || `Plik ${job.file_index + 1}`} Â· {job.material_name || 'MateriaĹ‚'} Â· {job.color || 'Kolor'} Â· wypeĹ‚nienie {job.infill_percent}%
                        </p>
                        {job.status === 'completed' && (
                          <p className="mt-2 text-sm">
                            {(seconds / 3600).toFixed(2)} h Â· {grams.toFixed(2)} g
                            {job.slicer_version ? ` Â· Creality Print ${job.slicer_version}` : ''}
                          </p>
                        )}
                        {job.error_message && (
                          <p className="mt-2 text-sm text-destructive">{job.error_message}</p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(job.requested_at).toLocaleString('pl-PL')}
                          {job.worker_id ? ` Â· worker ${job.worker_id}` : ''}
                        </p>
                      </div>
                      {(job.status === 'failed' || job.status === 'cancelled') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retry(job.id)}
                          disabled={retryingId === job.id}
                        >
                          {retryingId === job.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          )}
                          PonĂłw
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
