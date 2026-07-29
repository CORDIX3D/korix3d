'use client';

import { ErrorFallback } from '@/components/layout/error-fallback';

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      source="public"
      title="Nie udało się załadować strony"
      description="Dane są chwilowo niedostępne. Spróbuj ponownie, a jeśli problem się powtórzy, wróć na stronę główną."
    />
  );
}
