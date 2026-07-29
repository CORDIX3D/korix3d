import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { z } from 'zod';

const boundedInteger = (fallback, minimum, maximum) =>
  z.preprocess(
    (value) => value === undefined || value === '' ? fallback : value,
    z.coerce.number().int().min(minimum).max(maximum)
  );
const optionalText = z.preprocess(
  (value) => typeof value === 'string' && value.trim() ? value.trim() : null,
  z.string().nullable()
);
const workerEnvironmentSchema = z.object({
  KORIX3D_SITE_URL: z.string().trim().url().refine(
    (value) => ['http:', 'https:'].includes(new URL(value).protocol),
    'KORIX3D_SITE_URL must use HTTP or HTTPS'
  ),
  CREALITY_SLICER_WORKER_TOKEN: z.string().trim().min(32),
  CREALITY_PRINT_BIN: z.string().trim().min(1),
  CREALITY_PRINT_ARGS_JSON: z.string().transform((value, context) => {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
        throw new Error('expected an array of strings');
      }
      return parsed;
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'must be a JSON array containing only strings',
      });
      return z.NEVER;
    }
  }),
  SLICER_WORKER_ID: optionalText,
  CREALITY_PRINT_VERSION: optionalText,
  CREALITY_PRINTER_PROFILE: optionalText,
  CREALITY_PROCESS_PROFILE: optionalText,
  SLICER_POLL_INTERVAL_MS: boundedInteger(5_000, 1_000, 60_000),
  SLICER_JOB_TIMEOUT_MS: boundedInteger(12 * 60_000, 60_000, 30 * 60_000),
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
const workerToken = workerEnvironment.CREALITY_SLICER_WORKER_TOKEN;
const slicerBinary = workerEnvironment.CREALITY_PRINT_BIN;
const workerId = workerEnvironment.SLICER_WORKER_ID || `creality-${process.pid}`;
const slicerVersion = workerEnvironment.CREALITY_PRINT_VERSION;
const printerProfile = workerEnvironment.CREALITY_PRINTER_PROFILE;
const processProfile = workerEnvironment.CREALITY_PROCESS_PROFILE;
const pollIntervalMs = workerEnvironment.SLICER_POLL_INTERVAL_MS;
const timeoutMs = workerEnvironment.SLICER_JOB_TIMEOUT_MS;
const slicerProcessEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/(?:TOKEN|SECRET|PASSWORD|API_KEY)$/i.test(name)
  )
);
const maxFileBytes = 50 * 1024 * 1024;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function api(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${workerToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `KORIX3D API returned ${response.status}`);
  }
  return body;
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

function commandArguments(job, inputPath, outputDirectory) {
  const args = workerEnvironment.CREALITY_PRINT_ARGS_JSON;

  const replacements = {
    '{input}': inputPath,
    '{outputDir}': outputDirectory,
    '{infill}': String(job.infill_percent),
    '{printerProfile}': job.printer_profile || '',
    '{processProfile}': job.process_profile || '',
  };

  return args
    .map((argument) => {
      let prepared = argument;
      for (const [placeholder, value] of Object.entries(replacements)) {
        prepared = prepared.replaceAll(placeholder, value);
      }
      return prepared;
    })
    .filter(Boolean);
}

async function downloadInput(job, directory) {
  const extension = extname(job.file_name || '').toLowerCase();
  if (!['.stl', '.step', '.stp', '.obj', '.3mf'].includes(extension)) {
    throw new Error('Unsupported model file extension');
  }

  const response = await fetch(job.download_url);
  if (!response.ok) throw new Error(`Model download returned ${response.status}`);

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxFileBytes) throw new Error('Model exceeds the 50 MB limit');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > maxFileBytes) {
    throw new Error('Downloaded model has an invalid size');
  }

  const inputPath = join(directory, `input${extension}`);
  await writeFile(inputPath, buffer);
  return inputPath;
}

async function runSlicer(args) {
  await new Promise((resolve, reject) => {
    const processHandle = spawn(slicerBinary, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: slicerProcessEnvironment,
    });
    let stderr = '';
    const timer = setTimeout(() => {
      processHandle.kill('SIGKILL');
      reject(new Error('Creality Print exceeded the slicing timeout'));
    }, timeoutMs);

    processHandle.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-8_000);
    });
    processHandle.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    processHandle.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Creality Print exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

function timeToSeconds(value) {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)h/i)?.[1] || 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)m/i)?.[1] || 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)s/i)?.[1] || 0);
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

function parseGcode(content) {
  const timeMatch = content.match(
    /;\s*(?:estimated printing time|total estimated time|model printing time)[^=\n]*=\s*([^\r\n]+)/i
  );
  const gramsMatch = content.match(
    /;\s*(?:total filament used|filament used)\s*\[g\]\s*=\s*(\d+(?:\.\d+)?)/i
  );
  const layerMatch = content.match(/;\s*(?:total layer number|layer count)\s*[:=]\s*(\d+)/i);

  const rawTime = timeMatch?.[1]?.trim() || '';
  const printingTimeSeconds = /^\d+(?:\.\d+)?$/.test(rawTime)
    ? Number(rawTime)
    : timeToSeconds(rawTime);
  const filamentUsedGrams = gramsMatch ? Number(gramsMatch[1]) : 0;

  if (!(printingTimeSeconds > 0) || !(filamentUsedGrams > 0)) {
    throw new Error('Creality Print output does not contain time and filament metadata');
  }

  return {
    printing_time_seconds: printingTimeSeconds,
    filament_used_grams: filamentUsedGrams,
    layer_count: layerMatch ? Number(layerMatch[1]) : null,
  };
}

async function findGcode(directory) {
  const files = await readdir(directory, { recursive: true });
  const gcode = files.find((file) => extname(file).toLowerCase() === '.gcode');
  if (!gcode) throw new Error('Creality Print did not create a G-code file');
  return join(directory, gcode);
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
    const args = commandArguments(job, inputPath, directory);
    await runSlicer(args);
    const gcodePath = await findGcode(directory);
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
  process.stdout.write(`KORIX3D Creality worker ${workerId} started\n`);
  while (true) {
    try {
      const job = await claimJob();
      if (!job) {
        await sleep(pollIntervalMs);
        continue;
      }
      process.stdout.write(`Processing slicing job ${job.id}\n`);
      await processJob(job);
      process.stdout.write(`Completed slicing job ${job.id}\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      await sleep(pollIntervalMs);
    }
  }
}

await main();
