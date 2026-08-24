const STALE_CHUNK_PATTERNS = [
  'chunkloaderror',
  'loading chunk',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
];

function errorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name} ${error.message} ${error.stack || ''}`.toLowerCase();
  }

  return String(error || '').toLowerCase();
}

export function isStaleClientChunkError(error: unknown) {
  const text = errorText(error);
  return STALE_CHUNK_PATTERNS.some((pattern) => text.includes(pattern));
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function recoverFromStaleClientChunk(error: unknown) {
  if (typeof window === 'undefined' || !isStaleClientChunkError(error)) {
    return false;
  }

  const fingerprint = simpleHash(errorText(error).slice(0, 1000));
  const storageKey = `korix3d_chunk_reload:${window.location.pathname}:${fingerprint}`;

  try {
    if (window.sessionStorage.getItem(storageKey)) return false;
    window.sessionStorage.setItem(storageKey, '1');
  } catch {
    // Brak sessionStorage nie powinien blokować jednorazowego odświeżenia.
  }

  const freshUrl = new URL(window.location.href);
  freshUrl.searchParams.set('__korix_reload', Date.now().toString());
  window.location.replace(freshUrl.toString());
  return true;
}

export function reloadLatestClientVersion() {
  if (typeof window === 'undefined') return;
  const freshUrl = new URL(window.location.href);
  freshUrl.searchParams.set('__korix_reload', Date.now().toString());
  window.location.replace(freshUrl.toString());
}
