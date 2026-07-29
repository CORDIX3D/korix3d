import { NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isTrustedMutationRequest(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (fetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === 'null') return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function crossSiteRequestResponse() {
  return NextResponse.json(
    { error: 'Żądanie z niezaufanego źródła zostało odrzucone.' },
    {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
