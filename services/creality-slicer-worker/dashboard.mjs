import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const dashboardHtmlUrl = new URL('./dashboard.html', import.meta.url);
const responseHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...responseHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

export async function startWorkerDashboard({ port, getRuntimeState, getOverview }) {
  const html = await readFile(dashboardHtmlUrl, 'utf8');
  let overviewCache = null;
  let overviewCachedAt = 0;

  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      response.writeHead(200, {
        ...responseHeaders,
        'Content-Type': 'text/html; charset=utf-8',
      });
      response.end(html);
      return;
    }

    if (pathname === '/health') {
      sendJson(response, 200, { status: 'ok', runtime: getRuntimeState() });
      return;
    }

    if (pathname === '/api/state') {
      try {
        if (!overviewCache || Date.now() - overviewCachedAt > 5_000) {
          overviewCache = await getOverview();
          overviewCachedAt = Date.now();
        }
        sendJson(response, 200, {
          runtime: getRuntimeState(),
          overview: overviewCache,
        });
      } catch (error) {
        sendJson(response, 502, {
          runtime: getRuntimeState(),
          error: error instanceof Error ? error.message.slice(0, 300) : 'Connection failed',
        });
      }
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  return server;
}
