'use client';

import { ErrorFallback } from '@/components/layout/error-fallback';

export default function ErrorPage({
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
      source="root"
      title="Nie udało się załadować tej części strony"
      description="Spróbuj ponownie za chwilę. Jeśli problem wróci, przekaż nam widoczny identyfikator błędu."
    />
  );
}
