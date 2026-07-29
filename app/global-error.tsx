'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/monitoring/client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, 'global');
  }, [error]);

  return (
    <html lang="pl" className="dark">
      <body style={{ margin: 0, background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <div>
            <h1>Wystąpił nieoczekiwany błąd</h1>
            <p>Spróbuj ponownie. Jeśli problem wróci, skontaktuj się z obsługą KORIX3D.</p>
            {error.digest && <p>Identyfikator błędu: {error.digest}</p>}
            <button type="button" onClick={reset} style={{ marginTop: 16, padding: '12px 18px', cursor: 'pointer' }}>
              Spróbuj ponownie
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
