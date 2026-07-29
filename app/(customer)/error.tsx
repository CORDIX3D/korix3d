'use client';

import { ErrorFallback } from '@/components/layout/error-fallback';

export default function CustomerError({
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
      source="customer"
      title="Nie udało się załadować panelu klienta"
      description="Spróbuj ponownie. Jeśli problem się powtórzy, przekaż obsłudze widoczny identyfikator błędu."
      homeHref="/panel"
      homeLabel="Panel klienta"
    />
  );
}
