import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_RETURN_PATHS = [
  '/admin',
  '/panel',
  '/logowanie',
  '/rejestracja',
  '/odzyskaj-haslo',
  '/reset-password',
];

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function GET(request: NextRequest) {
  const requestedReturnTo = request.nextUrl.searchParams.get('returnTo') || '/';
  const returnTo = ALLOWED_RETURN_PATHS.some(
    (path) => requestedReturnTo === path || requestedReturnTo.startsWith(`${path}/`)
  )
    ? requestedReturnTo
    : '/';

  const html = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>Usługa chwilowo niedostępna | KORIX3D</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        color: #f8fafc;
        background:
          radial-gradient(circle at top, rgba(249, 115, 22, .14), transparent 42%),
          #09090b;
      }
      main {
        width: min(100%, 560px);
        padding: 40px;
        text-align: center;
        border: 1px solid #27272a;
        border-radius: 20px;
        background: rgba(24, 24, 27, .92);
        box-shadow: 0 24px 80px rgba(0, 0, 0, .35);
      }
      .mark {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        margin: 0 auto 24px;
        border-radius: 16px;
        color: #fb923c;
        font-size: 28px;
        font-weight: 800;
        background: rgba(249, 115, 22, .12);
      }
      h1 { margin: 0; font-size: clamp(26px, 5vw, 34px); line-height: 1.15; }
      p { margin: 16px auto 0; max-width: 440px; color: #a1a1aa; line-height: 1.65; }
      nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 30px; }
      a {
        min-width: 170px;
        padding: 12px 18px;
        border: 1px solid #3f3f46;
        border-radius: 10px;
        color: #fafafa;
        text-decoration: none;
        font-weight: 650;
      }
      a.primary { border-color: #f97316; background: #f97316; color: #18181b; }
      a:hover { filter: brightness(1.08); }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">K</div>
      <h1>Usługa jest chwilowo niedostępna</h1>
      <p>Nie możemy teraz bezpiecznie potwierdzić dostępu. Spróbuj ponownie za chwilę — Twoje dane nie zostały utracone.</p>
      <nav aria-label="Dalsze kroki">
        <a class="primary" href="${escapeHtml(returnTo)}">Spróbuj ponownie</a>
        <a href="/">Wróć na stronę główną</a>
      </nav>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '60',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
