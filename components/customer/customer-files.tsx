'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileBox, FolderOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  OrderFileDownload,
  type StoredOrderFile,
} from '@/components/customer/order-file-download';
import {
  PanelEmpty,
  PanelError,
  PanelHeading,
  PanelLoading,
} from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import type { Json } from '@/lib/types/database';

type OrderWithFiles = {
  id: string;
  order_number: string;
  files: Json;
  created_at: string;
};

type CustomerFile = StoredOrderFile & {
  orderId: string;
  orderNumber: string;
  orderCreatedAt: string;
  position: number;
};

function asStoredFile(value: Json): StoredOrderFile | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;

  const file = value as Record<string, Json | undefined>;
  return {
    name: typeof file.name === 'string' ? file.name : undefined,
    size: typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : undefined,
    type: typeof file.type === 'string' ? file.type : undefined,
    bucket: typeof file.bucket === 'string' ? file.bucket : undefined,
    storage_path: typeof file.storage_path === 'string' ? file.storage_path : undefined,
  };
}

function flattenOrderFiles(orders: OrderWithFiles[]): CustomerFile[] {
  return orders.flatMap((order) => {
    if (!Array.isArray(order.files)) return [];

    return order.files.flatMap((value, position) => {
      const file = asStoredFile(value);
      if (!file) return [];

      return [{
        ...file,
        orderId: order.id,
        orderNumber: order.order_number,
        orderCreatedAt: order.created_at,
        position,
      }];
    });
  });
}

function formatFileSize(size?: number) {
  if (typeof size !== 'number' || size < 0) return 'Rozmiar niedostępny';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function CustomerFiles() {
  const { user } = useAuth();
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('orders_3d')
        .select('id, order_number, files, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;
      setFiles(flattenOrderFiles((data || []) as OrderWithFiles[]));
    } catch {
      setFiles([]);
      setError('Nie udało się pobrać plików z Twoich zleceń. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const orderCount = useMemo(
    () => new Set(files.map((file) => file.orderId)).size,
    [files]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PanelHeading
          title="Pliki"
          description="Modele przesłane do wyceny i powiązane z Twoimi zleceniami."
        />
        <Button type="button" variant="outline" onClick={loadFiles} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </div>

      {loading ? (
        <PanelLoading label="Pobieranie plików..." />
      ) : error ? (
        <PanelError message={error} onRetry={loadFiles} />
      ) : files.length === 0 ? (
        <PanelEmpty
          icon={FolderOpen}
          title="Nie masz jeszcze przesłanych plików"
          description="Pliki pojawią się tutaj po wysłaniu modelu w kalkulatorze wyceny."
          actionLabel="Wyceń wydruk"
          actionHref="/wycena"
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {files.length} {files.length === 1 ? 'plik' : 'plików'} w {orderCount}{' '}
            {orderCount === 1 ? 'zleceniu' : 'zleceniach'}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {files.map((file) => (
              <Card key={`${file.orderId}-${file.position}`} className="overflow-hidden">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                      <FileBox className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold" title={file.name || undefined}>
                        {file.name || `Plik ${file.position + 1}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                        {file.type ? ` · ${file.type}` : ''}
                      </p>
                    </div>
                    <OrderFileDownload file={file} />
                  </div>

                  <div className="mt-5 border-t border-border pt-4 text-sm">
                    <p className="text-muted-foreground">
                      Zlecenie z {new Date(file.orderCreatedAt).toLocaleDateString('pl-PL')}
                    </p>
                    <Button asChild variant="link" className="mt-1 h-auto p-0">
                      <Link href={`/panel/zamowienia/${file.orderId}`}>
                        {file.orderNumber}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
