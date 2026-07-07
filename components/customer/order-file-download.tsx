'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';

export interface StoredOrderFile {
  name?: string;
  size?: number;
  type?: string;
  bucket?: string;
  storage_path?: string;
}

export function OrderFileDownload({ file }: { file: StoredOrderFile }) {
  const [loading, setLoading] = useState(false);

  if (!file.storage_path) return null;

  const download = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage
      .from(file.bucket || 'quote-files')
      .createSignedUrl(file.storage_path!, 60, { download: file.name || true });

    if (error || !data?.signedUrl) {
      toast.error('Nie udało się pobrać pliku', { description: 'Link do pliku nie mógł zostać utworzony.' });
    } else {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
    setLoading(false);
  };

  return (
    <Button type="button" size="sm" variant="ghost" onClick={download} disabled={loading} aria-label={`Pobierz ${file.name || 'plik'}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}
