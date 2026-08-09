import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';
import {
  buildCrealityArguments,
  createWorkerSignatureHeaders,
  parseFilamentProfiles,
  parseGcode,
  probeExecutable,
  runCrealityAndWait,
  selectFilamentProfile,
} from './worker-lib.mjs';
import { startWorkerDashboard } from './dashboard.mjs';

const boundedInteger = (fallback, minimum, maximum) =>
  z.preprocess(
    (value) => value === undefined || value === '' ? fallback : value,
    z.coerce.number().int().min(minimum).max(maximum)
  );
const workerEnvironmentSchema = z.object({
  KORIX3D_SITE_URL: z.string().trim().url().refine(
    (value) => ['http:', 'https:'].includes(new URL(value).protocol),
    'KORIX3D_SITE_URL must use HTTP or HTTPS'
  ),
  CREALITY_SLICER_WORKER_PRIVATE_KEY_PATH: z.string().trim().min(1),
  CREALITY_PRINT_BIN: z.string().trim().min(1),
  CREALITY_MACHINE_PROFILE_PATH: z.string().trim().min(1),
  CREALITY_PROCESS_PROFILE_PATH: z.string().trim().min(1),
  CREALITY_FILAMENT_PROFILES_JSON: z.string().transform((value, context) => {
    try {
      return parseFilamentProfiles(value);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : 'invalid filament profiles',
      });
      return z.NEVER;
    }
  }),
  SLICER_WORKER_ID: z.string().trim().min(3).max(120),
  CREALITY_PRINT_VERSION: z.string().trim().min(1).max(120),
  CREALITY_PRINTER_PROFILE: z.string().trim().min(1).max(240),
  CREALITY_PROCESS_PROFILE: z.string().trim().min(1).max(240),
  SLICER_POLL_INTERVAL_MS: boundedInteger(5_000, 1_000, 60_000),
  // Baza odzyskuje zadanie po 20 minutach, więc worker musi zakończyć próbę wcześniej.
  SLICER_JOB_TIMEOUT_MS: boundedInteger(12 * 60_000, 60_000, 18 * 60_000),
  SLICER_HTTP_TIMEOUT_MS: boundedInteger(60_000, 5_000, 5 * 60_000),
  SLICER_DASHBOARD_PORT: boundedInteger(4_317, 1_024, 65_535),
});
const parsedEnvironment = workerEnvironmentSchema.safeParse(process.env);
if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid Creality worker environment: ${issues}`);
}
const workerEnvironment = parsedEnvironment.data;
const siteUrl = workerEnvironment.KORIX3D_SITE_URL.replace(/\/+$/, '');
const workerPrivateKeyPath = workerEnvironment.CREALITY_SLICER_WORKER_PRIVATE_KEY_PATH;
const slicerBinary = workerEnvironment.CREALITY_PRINT_BIN;
const machineProfilePath = workerEnvironment.CREALITY_MACHINE_PROFILE_PATH;
const processProfilePath = workerEnvironment.CREALITY_PROCESS_PROFILE_PATH;
const filamentProfiles = workerEnvironment.CREALITY_FILAMENT_PROFILES_JSON;
const workerId = workerEnvironment.SLICER_WORKER_ID;
const slicerVersion = workerEnvironment.CREALITY_PRINT_VERSION;
const printerProfile = workerEnvironment.CREALITY_PRINTER_PROFILE;
const processProfile = workerEnvironment.CREALITY_PROCESS_PROFILE;
const pollIntervalMs = workerEnvironment.SLICER_POLL_INTERVAL_MS;
const timeoutMs = workerEnvironment.SLICER_JOB_TIMEOUT_MS;
const httpTimeoutMs = workerEnvironment.SLICER_HTTP_TIMEOUT_MS;
const dashboardPort = workerEnvironment.SLICER_DASHBOARD_PORT;
const workerPrivateKey = await readFile(workerPrivateKeyPath, 'utf8');
const slicerProcessEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/(?:TOKEN|SECRET|PASSWORD|API_KEY)$/i.test(name)
  )
);
const maxFileBytes = 50 * 1024 * 1024;
let stopping = false;
const runtimeState = {
  status: 'starting',
  started_at: new Date().toISOString(),
  last_connected_at: null,
  last_completed_at: null,
  last_error: null,
  current_job_id: null,
  current_job_name: null,
};

function updateRuntimeState(patch) {
  Object.assign(runtimeState, patch);
}

function sanitizeLogText(value) {
  return String(value || '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED]')
    .slice(0, 1000);
}

function log(level, event, details = {}) {
  const record = {
    type: 'korix3d_slicer_worker',
    level,
    event,
    occurredAt: new Date().toISOString(),
    workerId,
    ...details,
  };
  const output = `${JSON.stringify(record)}\n`;
  if (level === 'error') process.stderr.write(output);
  else process.stdout.write(output);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!stopping) log('info', 'shutdown_requested', { signal });
    stopping = true;
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? options.body : '';
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(httpTimeoutMs),
    headers: {
      'Content-Type': 'application/json',
      ...createWorkerSignatureHeaders({
        privateKey: workerPrivateKey,
        workerId,
        method,
        pathname: path,
        body,
      }),
      ...(options.headers || {}),
    },
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(responseBody?.error || `KORIX3D API returned ${response.status}`);
  }
  return responseBody;
}

async function claimJob() {
  const response = await api('/api/slicer/jobs/claim', {
    method: 'POST',
    body: JSON.stringify({
      worker_id: workerId,
      printer_profile: printerProfile,
      process_profile: processProfile,
      slicer_version: slicerVersion,
    }),
  });
  return response.job || null;
}

async function downloadInput(job, directory) {
  const extension = extname(job.file_name || '').toLowerCase();
  if (!['.stl', '.step', '.stp', '.obj', '.3mf'].includes(extension)) {
    throw new Error('Unsupported model file extension');
  }

  const response = await fetch(job.download_url, {
    signal: AbortSignal.timeout(httpTimeoutMs),
  });
  if (!response.ok) throw new Error(`Model download returned ${response.status}`);

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxFileBytes) throw new Error('Model exceeds the 50 MB limit');

  if (!response.body) throw new Error('Model download returned an empty response');
  const reader = response.body.getReader();
  const chunks = [];
  let downloadedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    downloadedBytes += value.length;
    if (downloadedBytes > maxFileBytes) {
      await reader.cancel();
      throw new Error('Downloaded model exceeds the 50 MB limit');
    }
    chunks.push(Buffer.from(value));
  }

  const buffer = Buffer.concat(chunks, downloadedBytes);
  if (!buffer.length) {
    throw new Error('Downloaded model has an invalid size');
  }
  const expectedSize = Number(job.file_size || 0);
  if (expectedSize > 0 && buffer.length !== expectedSize) {
    throw new Error('Downloaded model size does not match the stored metadata');
  }

  const inputPath = join(directory, `input${extension}`);
  await writeFile(inputPath, buffer);
  return inputPath;
}

async function completeJob(jobId, payload) {
  await api(`/api/slicer/jobs/${jobId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      slicer_name: 'Creality Print',
      slicer_version: slicerVersion,
    }),
  });
}

async function processJob(job) {
  const directory = await mkdtemp(join(tmpdir(), 'korix3d-slicer-'));
  try {
    const inputPath = await downloadInput(job, directory);
    const filamentProfilePath = selectFilamentProfile(
      filamentProfiles,
      job.material_name || job.material
    );
    const args = buildCrealityArguments({
      machineProfilePath,
      processProfilePath,
      filamentProfilePath,
      infillPercent: job.infill_percent,
      inputPath,
      outputDirectory: directory,
    });
    const gcodePath = await runCrealityAndWait({
      binary: slicerBinary,
      args,
      outputDirectory: directory,
      environment: slicerProcessEnvironment,
      timeoutMs,
    });
    const result = parseGcode(await readFile(gcodePath, 'utf8'));
    await completeJob(job.id, {
      status: 'completed',
      ...result,
      gcode_file_name: basename(gcodePath),
    });
  } catch (error) {
    await completeJob(job.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown slicer error',
    }).catch(() => undefined);
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  await Promise.all([
    access(slicerBinary),
    access(workerPrivateKeyPath),
    access(machineProfilePath),
    access(processProfilePath),
    ...Object.values(filamentProfiles).map((profilePath) => access(profilePath)),
  ]);
  let dashboardServer = null;
  try {
    dashboardServer = await startWorkerDashboard({
      port: dashboardPort,
      getRuntimeState: () => ({ ...runtimeState }),
      getOverview: () => api('/api/slicer/dashboard'),
    });
    log('info', 'dashboard_started', { url: `http://127.0.0.1:${dashboardPort}` });
  } catch (error) {
    log('error', 'dashboard_start_failed', {
      message: sanitizeLogText(error instanceof Error ? error.message : error),
    });
  }
  log('info', 'started', {
    slicerVersion,
    printerProfile,
    processProfile,
    materials: Object.keys(filamentProfiles),
  });
  let consecutiveFailures = 0;
  let slicerReady = false;
  while (!stopping) {
    try {
      if (!slicerReady) {
        updateRuntimeState({ status: 'starting', last_error: null });
        try {
          await probeExecutable(slicerBinary, slicerProcessEnvironment);
          slicerReady = true;
          updateRuntimeState({ status: 'idle', last_error: null });
          log('info', 'slicer_preflight_passed');
        } catch (error) {
          const message = sanitizeLogText(error instanceof Error ? error.message : error);
          updateRuntimeState({ status: 'blocked', last_error: message });
          log('error', 'slicer_preflight_failed', { message, retryInMs: 60_000 });
          await sleep(60_000);
          continue;
        }
      }
      const job = await claimJob();
      updateRuntimeState({ last_connected_at: new Date().toISOString() });
      if (!job) {
        consecutiveFailures = 0;
        updateRuntimeState({ status: 'idle', current_job_id: null, current_job_name: null });
        await sleep(pollIntervalMs);
        continue;
      }
      updateRuntimeState({
        status: 'processing',
        current_job_id: job.id,
        current_job_name: job.file_name || `Plik ${job.file_index + 1}`,
        last_error: null,
      });
      log('info', 'job_started', { jobId: job.id, attempt: job.attempt_count });
      await processJob(job);
      consecutiveFailures = 0;
      updateRuntimeState({
        status: 'idle',
        last_completed_at: new Date().toISOString(),
        current_job_id: null,
        current_job_name: null,
      });
      log('info', 'job_completed', { jobId: job.id });
    } catch (error) {
      consecutiveFailures += 1;
      const message = sanitizeLogText(error instanceof Error ? error.message : error);
      if (/spawn|access|executable|Creality Print/i.test(message)) slicerReady = false;
      updateRuntimeState({
        status: slicerReady ? 'error' : 'blocked',
        last_error: message,
        current_job_id: null,
        current_job_name: null,
      });
      const backoffMs = Math.min(
        60_000,
        pollIntervalMs * (2 ** Math.min(consecutiveFailures - 1, 4))
      );
      log('error', 'iteration_failed', {
        message,
        consecutiveFailures,
        retryInMs: backoffMs,
      });
      if (!stopping) await sleep(backoffMs + Math.floor(Math.random() * 1000));
    }
  }
  if (dashboardServer) {
    dashboardServer.closeAllConnections?.();
    await new Promise((resolve) => dashboardServer.close(resolve));
  }
  log('info', 'stopped');
}

await main().catch((error) => {
  log('error', 'fatal', {
    message: sanitizeLogText(error instanceof Error ? error.message : error),
  });
  process.exitCode = 1;
});
