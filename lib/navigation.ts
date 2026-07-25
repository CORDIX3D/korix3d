const INTERNAL_BASE_URL = 'https://korix3d.internal';

export function parseInternalPath(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value, INTERNAL_BASE_URL);
    if (url.origin !== INTERNAL_BASE_URL) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function normalizeInternalPath(
  value: string | null | undefined,
  fallback = '/'
) {
  return parseInternalPath(value) || fallback;
}

export function isPathWithin(
  value: string,
  allowedPrefixes: readonly string[]
) {
  const parsed = parseInternalPath(value);
  if (!parsed) return false;
  const pathname = new URL(parsed, INTERNAL_BASE_URL).pathname;

  return allowedPrefixes.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
