'use client';

export function reportClientError(
  error: Error & { digest?: string },
  source: string
) {
  const fingerprint = `${source}:${error.digest || error.message}`.slice(0, 500);
  const storageKey = `korix3d_reported_error:${fingerprint}`;

  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // Raport nadal może zostać wysłany, gdy sessionStorage jest niedostępny.
  }

  void fetch('/api/monitoring/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      source,
      message: error.message || 'Błąd renderowania',
      digest: error.digest || '',
      stack: error.stack || '',
      path: window.location.pathname,
    }),
  }).catch(() => undefined);
}
