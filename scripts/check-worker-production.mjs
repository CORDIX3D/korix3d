import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const worker = await readFile(join(root, 'services/creality-slicer-worker/worker.mjs'), 'utf8');
const workerLibrary = await readFile(join(root, 'services/creality-slicer-worker/worker-lib.mjs'), 'utf8');
const threeMfFallback = await readFile(join(root, 'services/creality-slicer-worker/three-mf-to-stl.mjs'), 'utf8');
const threeMfWorker = await readFile(join(root, 'services/creality-slicer-worker/three-mf-converter-worker.mjs'), 'utf8');
const threeMfClient = await readFile(join(root, 'services/creality-slicer-worker/three-mf-converter-client.mjs'), 'utf8');
const stepConverter = await readFile(join(root, 'services/creality-slicer-worker/step-converter.mjs'), 'utf8');
const freeCadScript = await readFile(join(root, 'services/creality-slicer-worker/freecad-step-to-stl.py'), 'utf8');
const installer = await readFile(join(root, 'services/creality-slicer-worker/install-windows-task.ps1'), 'utf8');
const claim = await readFile(join(root, 'app/api/slicer/jobs/claim/route.ts'), 'utf8');
const heartbeat = await readFile(join(root, 'app/api/slicer/heartbeat/route.ts'), 'utf8');
const completion = await readFile(join(root, 'app/api/slicer/jobs/[id]/complete/route.ts'), 'utf8');
const retryMigration = await readFile(join(root, 'supabase/migrations/20260729150000_retry_failed_slicing_jobs.sql'), 'utf8');

for (const requirement of [
  "type: 'korix3d_slicer_worker'",
  "log('info', 'shutdown_requested'",
  'consecutiveFailures',
  '18 * 60_000',
  'buildCrealityArguments',
  'selectFilamentProfile',
  'three_mf_compatibility_prepared',
  'processJobWithHeartbeat',
  'convert3mfInWorker',
  'convertStepToStl',
  'step_compatibility_prepared',
  "api('/api/slicer/heartbeat'",
  'process.exitCode = 1',
]) {
  if (!worker.includes(requirement)) throw new Error(`Worker nie zawiera: ${requirement}`);
}
if (!stepConverter.includes("spawn(binary, [scriptPath]") ||
    !stepConverter.includes('STEP compatibility conversion timed out')) {
  throw new Error('Konwerter STEP nie kontroluje procesu FreeCAD i timeoutu.');
}
if (!freeCadScript.includes('Part.insert') || !freeCadScript.includes('Mesh.export')) {
  throw new Error('Skrypt FreeCAD nie importuje STEP i nie eksportuje STL.');
}
if (!threeMfWorker.includes('workerData') || !threeMfWorker.includes('convert3mfToBinaryStl')) {
  throw new Error('Konwerter 3MF nie jest uruchamiany w odizolowanym wątku.');
}
if (!threeMfClient.includes("new Worker(") || !threeMfClient.includes('conversion timed out')) {
  throw new Error('Klient konwertera 3MF nie kontroluje osobnego wątku i timeoutu.');
}
for (const requirement of ['JSZip.loadAsync', '3dmodel\\.model', 'binaryStl']) {
  if (!threeMfFallback.includes(requirement)) {
    throw new Error(`Konwerter zgodności 3MF nie zawiera: ${requirement}`);
  }
}
for (const requirement of [
  "'--load-settings'",
  "'--load-filaments'",
  "'--sparse-infill-density'",
  "'--no-check'",
  "'--allow-newer-file'",
  "'--ensure-on-bed'",
  "'--allow-multicolor-oneplate'",
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
if (!heartbeat.includes("from('slicer_workers').upsert") || !heartbeat.includes('requireSlicerWorker')) {
  throw new Error('Endpoint heartbeat nie zapisuje podpisanego stanu workera.');
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
