const ALLOWED_BROWSER_ORIGINS = new Set([
  'https://korix3d.pl',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

export function isAllowedBrowserOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || ALLOWED_BROWSER_ORIGINS.has(origin);
}

export function responseHeaders(request: Request) {
  const origin = request.headers.get('origin');
  return {
    ...(origin && ALLOWED_BROWSER_ORIGINS.has(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {}),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request),
  });
}
