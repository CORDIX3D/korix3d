import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const nextBinary = require.resolve('next/dist/bin/next');
const port = 3200 + (process.pid % 500);
const origin = `http://127.0.0.1:${port}`;
const publicPages = [
  '/',
  '/sklep',
  '/koszyk',
  '/checkout',
  '/wycena',
  '/materialy',
  '/portfolio',
  '/blog',
  '/kontakt',
  '/faq',
  '/dostawa',
  '/reklamacje',
  '/zwroty',
  '/regulamin',
  '/polityka-prywatnosci',
  '/logowanie',
  '/rejestracja',
  '/odzyskaj-haslo',
  '/reset-password',
];
const authenticationPages = new Set([
  '/logowanie',
  '/rejestracja',
  '/odzyskaj-haslo',
  '/reset-password',
]);
const invalidRequestCases = [
  ['/api/public/contact', {}],
  ['/api/public/newsletter', { email: 'niepoprawny-email' }],
  ['/api/store/orders', {}],
  ['/api/store/coupons', { code: 'zły kod', items: [] }],
  ['/api/stripe/create-checkout-session', {}],
];

const server = spawn(
  process.execPath,
  [nextBinary, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-4000);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(path, options = {}) {
  return fetch(`${origin}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
    ...options,
  });
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Serwer zakończył pracę przed testem.\n${serverOutput}`);
    }

    try {
      const response = await request('/');
      if (response.status === 200) return;
    } catch {
      // The server may still be starting.
    }
    await delay(250);
  }
  throw new Error(`Serwer nie uruchomił się w ciągu 60 sekund.\n${serverOutput}`);
}

function assertStatus(path, actual, expected) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(actual)) {
    throw new Error(`${path}: oczekiwano statusu ${accepted.join(' lub ')}, otrzymano ${actual}`);
  }
}

async function testPublicPages() {
  for (const path of publicPages) {
    const response = await request(path);
    assertStatus(path, response.status, authenticationPages.has(path) ? [200, 503] : 200);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error(`${path}: odpowiedź nie jest dokumentem HTML`);
    }
    const html = await response.text();
    if (!html.toLowerCase().includes('<html')) {
      throw new Error(`${path}: odpowiedź nie zawiera kompletnego dokumentu HTML`);
    }
  }
}

async function testRoutingAndHealth() {
  const missing = await request('/__korix_smoke_missing__');
  assertStatus('strona 404', missing.status, 404);

  for (const path of ['/panel', '/admin']) {
    const response = await request(path);
    // With Supabase configured an anonymous visitor is redirected to login.
    // Without configuration the protected service correctly returns 503.
    assertStatus(path, response.status, [307, 503]);
  }

  const health = await request('/api/health');
  assertStatus('/api/health', health.status, [200, 503]);
  const payload = await health.json();
  if (!['ok', 'degraded'].includes(payload.status) || !payload.checkedAt) {
    throw new Error('/api/health: nieprawidłowa odpowiedź stanu usług');
  }

  const invalidFilamentRequest = await request(
    '/api/public/filaments?material_id=niepoprawny'
  );
  assertStatus(
    '/api/public/filaments (błędny materiał)',
    invalidFilamentRequest.status,
    400
  );
}

async function testInvalidRequests() {
  for (const [path, body] of invalidRequestCases) {
    const response = await request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    assertStatus(`${path} (błędne dane)`, response.status, 400);
  }
}

let exitCode = 0;
try {
  await waitForServer();
  await testPublicPages();
  await testRoutingAndHealth();
  await testInvalidRequests();
  console.log(
    `Test uruchomieniowy zakończony: ${publicPages.length} stron, 404, panele, health i ${invalidRequestCases.length + 1} walidacji API.`
  );
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : error);
  if (serverOutput) console.error(serverOutput);
} finally {
  if (server.exitCode === null) server.kill();
}

process.exitCode = exitCode;
