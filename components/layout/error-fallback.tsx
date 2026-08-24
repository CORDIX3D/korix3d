'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportClientError } from '@/lib/monitoring/client';
import {
  isStaleClientChunkError,
  recoverFromStaleClientChunk,
  reloadLatestClientVersion,
} from '@/lib/client-version-recovery';

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
  source: string;
  title: string;
  description: string;
  homeHref?: string;
  homeLabel?: string;
};

export function ErrorFallback({
  error,
  reset,
  source,
  title,
  description,
  homeHref = '/',
  homeLabel = 'Strona główna',
}: ErrorFallbackProps) {
  const staleClientVersion = isStaleClientChunkError(error);

  useEffect(() => {
    reportClientError(error, source);
    recoverFromStaleClientChunk(error);
  }, [error, source]);

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-destructive">
          Coś poszło nie tak
        </p>
        <h1 className="mb-4 text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="mb-8 text-muted-foreground">
          {staleClientVersion
            ? 'Wykryliśmy starszą wersję strony po aktualizacji. Odświeżamy ją automatycznie.'
            : description}
        </p>
        {error.digest && (
          <p className="mb-6 text-xs text-muted-foreground">
            Identyfikator błędu: <code>{error.digest}</code>
          </p>
        )}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={staleClientVersion ? reloadLatestClientVersion : reset}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {staleClientVersion ? 'Pobierz nową wersję' : 'Spróbuj ponownie'}
          </Button>
          <Button asChild variant="outline">
            <Link href={homeHref}>
              <Home className="mr-2 h-4 w-4" />
              {homeLabel}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
