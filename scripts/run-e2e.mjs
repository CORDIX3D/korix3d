import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const nextBinary = require.resolve('next/dist/bin/next');
const playwrightBinary = require.resolve('@playwright/test/cli');
const args = process.argv.slice(2);
const usePrebuiltApplication = args[0] === '--prebuilt';
const playwrightArgs = usePrebuiltApplication ? args.slice(1) : args;
const port = 3100 + (process.pid % 500);
const origin = `http://127.0.0.1:${port}`;
const isolatedEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  NEXT_PUBLIC_SITE_URL: origin,
};

function run(binary, args, environment = isolatedEnvironment) {
  const result = spawnSync(process.execPath, [binary, ...args], {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (!usePrebuiltApplication) {
  console.log('Tworzenie izolowanego buildu E2E bez połączeń z usługami produkcyjnymi...');
  const buildStatus = run(nextBinary, ['build']);
  if (buildStatus !== 0) process.exit(buildStatus);
}

const server = spawn(
  process.execPath,
  [nextBinary, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  {
    cwd: process.cwd(),
    env: isolatedEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-6000);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Serwer E2E zakończył pracę przed testem.\n${serverOutput}`);
    }
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // Serwer może być jeszcze uruchamiany.
    }
    await delay(250);
  }
  throw new Error(`Serwer E2E nie uruchomił się w ciągu 60 sekund.\n${serverOutput}`);
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = run(playwrightBinary, ['test', ...playwrightArgs], {
    ...isolatedEnvironment,
    PLAYWRIGHT_BASE_URL: origin,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (server.exitCode === null) server.kill();
}

process.exitCode = exitCode;
