import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const worker = await readFile(join(root, 'services/creality-slicer-worker/worker.mjs'), 'utf8');
const workerLibrary = await readFile(join(root, 'services/creality-slicer-worker/worker-lib.mjs'), 'utf8');
const installer = await readFile(join(root, 'services/creality-slicer-worker/install-windows-task.ps1'), 'utf8');
const claim = await readFile(join(root, 'app/api/slicer/jobs/claim/route.ts'), 'utf8');
const completion = await readFile(join(root, 'app/api/slicer/jobs/[id]/complete/route.ts'), 'utf8');
const retryMigration = await readFile(join(root, 'supabase/migrations/20260729150000_retry_failed_slicing_jobs.sql'), 'utf8');

for (const requirement of [
  "type: 'korix3d_slicer_worker'",
  "log('info', 'shutdown_requested'",
  'consecutiveFailures',
  '18 * 60_000',
  'buildCrealityArguments',
  'selectFilamentProfile',
  'process.exitCode = 1',
]) {
  if (!worker.includes(requirement)) throw new Error(`Worker nie zawiera: ${requirement}`);
}
for (const requirement of [
  "'--load-settings'",
  "'--load-filaments'",
  "'--sparse-infill-density'",
  "'--outputdir'",
  'waitForStableGcode',
  'total layers count',
]) {
  if (!workerLibrary.includes(requirement)) {
    throw new Error(`Biblioteka workera nie zawiera: ${requirement}`);
  }
}
for (const requirement of ['-RestartCount 999', '-MultipleInstances IgnoreNew', '-AtStartup']) {
  if (!installer.includes(requirement)) throw new Error(`Instalator procesu nie zawiera: ${requirement}`);
}
if (!claim.includes('createSignedUrl(storagePath, 15 * 60)')) {
  throw new Error('Worker nie otrzymuje krótkotrwałego adresu pobierania.');
}
if (!claim.includes('material_name: job.material_name')) {
  throw new Error('API workera nie zwraca jednoznacznej nazwy materiału.');
}
if (!completion.includes("'fail_or_retry_slicing_job'")) {
  throw new Error('Endpoint zakończenia nie uruchamia kontrolowanego retry.');
}
if (!retryMigration.includes('job_row.attempt_count < 3')) {
  throw new Error('Baza nie ogranicza liczby automatycznych prób.');
}

console.log('Pipeline Creality ma timeout, retry, heartbeat, logi i automatyczny restart.');
