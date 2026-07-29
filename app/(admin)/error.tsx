'use client';

import { ErrorFallback } from '@/components/layout/error-fallback';

export default function AdminError({
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
      source="admin"
      title="Nie udało się załadować panelu administratora"
      description="Zmiany nie zostały utracone. Spróbuj ponownie i przekaż identyfikator błędu, jeśli problem wróci."
      homeHref="/admin"
      homeLabel="Panel administratora"
    />
  );
}
