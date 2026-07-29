import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const route = await readFile(
  join(root, 'app/api/monitoring/production-health/route.ts'),
  'utf8'
);
const client = await readFile(join(root, 'lib/monitoring/client.ts'), 'utf8');
const server = await readFile(join(root, 'lib/monitoring/server.ts'), 'utf8');

const cron = vercel.crons?.find(
  (entry) => entry.path === '/api/monitoring/production-health'
);
if (!cron || cron.schedule !== '0 5 * * *') {
  throw new Error('Brak codziennej kontroli produkcyjnej zgodnej z limitem Vercel Hobby.');
}

for (const requirement of [
  'CRON_SECRET',
  'timingSafeEqual',
  "type: 'korix3d_production_health'",
  'stripe_webhook_events',
  'slicing_jobs',
  'slicer_workers',
  'storage.listBuckets()',
]) {
  if (!route.includes(requirement)) {
    throw new Error(`Monitoring nie obejmuje: ${requirement}`);
  }
}

if (!client.includes("fetch('/api/monitoring/client-error'")) {
  throw new Error('Błędy renderowania klienta nie są raportowane.');
}
if (!server.includes("type: 'korix3d_error'")) {
  throw new Error('Błędy serwera nie mają ustrukturyzowanego rekordu.');
}

console.log('Monitoring produkcyjny obejmuje API, Supabase, Stripe, Storage i worker.');
