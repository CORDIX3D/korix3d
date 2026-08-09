import { spawn } from 'node:child_process';
import { createHash, sign } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

export function normalizeMaterialName(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-');
}

export function createWorkerSignatureHeaders({
  privateKey,
  workerId,
  method,
  pathname,
  body,
  timestamp = String(Date.now()),
}) {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const canonical = `${timestamp}\n${workerId}\n${method.toUpperCase()}\n${pathname}\n${bodyHash}`;
  const signature = sign(null, Buffer.from(canonical), privateKey).toString('base64url');
  return {
    'X-Korix3D-Timestamp': timestamp,
    'X-Korix3D-Worker-Id': workerId,
    'X-Korix3D-Signature': signature,
  };
}

export function parseFilamentProfiles(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('CREALITY_FILAMENT_PROFILES_JSON must be valid JSON');
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('CREALITY_FILAMENT_PROFILES_JSON must be an object');
  }

  const entries = Object.entries(parsed).map(([material, profilePath]) => [
    normalizeMaterialName(material),
    typeof profilePath === 'string' ? profilePath.trim() : '',
  ]);
  if (!entries.length || entries.some(([material, profilePath]) => !material || !profilePath)) {
    throw new Error('CREALITY_FILAMENT_PROFILES_JSON must map materials to profile paths');
  }

  return Object.fromEntries(entries);
}

export function selectFilamentProfile(profiles, materialName) {
  const normalized = normalizeMaterialName(materialName);
  const profile = profiles[normalized];
  if (!profile) {
    throw new Error(`No Creality filament profile configured for material ${normalized || 'UNKNOWN'}`);
  }
  return profile;
}

export function buildCrealityArguments({
  machineProfilePath,
  processProfilePath,
  filamentProfilePath,
  infillPercent,
  inputPath,
  outputDirectory,
}) {
  const infill = Number(infillPercent);
  if (!Number.isInteger(infill) || infill < 1 || infill > 100) {
    throw new Error('Infill percentage must be an integer between 1 and 100');
  }

  return [
    '--load-settings',
    `${machineProfilePath};${processProfilePath}`,
    '--load-filaments',
    filamentProfilePath,
    '--sparse-infill-density',
    `${infill}%`,
    '--slice',
    '0',
    '--outputdir',
    outputDirectory,
    inputPath,
  ];
}

export function timeToSeconds(value) {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)h/i)?.[1] || 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)m/i)?.[1] || 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)s/i)?.[1] || 0);
  return Math.round(hours * 3600 + minutes * 60 + seconds);
}

export function parseGcode(content) {
  const timeMatch = content.match(
    /;\s*(?:estimated printing time|total estimated time|model printing time)[^=\n]*=\s*([^\r\n]+)/i
  );
  const gramsMatch = content.match(
    /;\s*(?:total filament used|filament used)\s*\[g\]\s*=\s*(\d+(?:\.\d+)?)/i
  );
  const layerMatch = content.match(
    /;\s*(?:total layer number|total layers count|layer count)\s*[:=]\s*(\d+)/i
  );

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

export async function findGcode(directory) {
  const files = await readdir(directory, { recursive: true });
  const gcode = files.find((file) => extname(file).toLowerCase() === '.gcode');
  return gcode ? join(directory, gcode) : null;
}

export async function waitForStableGcode(directory, timeoutMs, pollIntervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let previousPath = null;
  let previousSize = -1;

  while (Date.now() < deadline) {
    const path = await findGcode(directory);
    if (path) {
      const file = await stat(path);
      if (file.size > 0 && path === previousPath && file.size === previousSize) return path;
      previousPath = path;
      previousSize = file.size;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Creality Print did not create a complete G-code file before timeout');
}

export async function runCrealityAndWait({
  binary,
  args,
  outputDirectory,
  environment,
  timeoutMs,
}) {
  let stderr = '';
  let processError = null;
  let exitCode = null;

  const processHandle = spawn(binary, args, {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: environment,
  });
  processHandle.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  processHandle.once('error', (error) => {
    processError = error;
  });
  processHandle.once('close', (code) => {
    exitCode = code;
  });

  const startedAt = Date.now();
  try {
    const gcodePath = await waitForStableGcode(outputDirectory, timeoutMs);
    if (processError) throw processError;
    return gcodePath;
  } catch (error) {
    if (processHandle.exitCode === null && !processHandle.killed) processHandle.kill('SIGKILL');
    if (processError) throw processError;
    if (exitCode !== null && exitCode !== 0) {
      throw new Error(`Creality Print exited with code ${exitCode}: ${stderr.trim()}`);
    }
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    throw new Error(`${error instanceof Error ? error.message : 'Slicing failed'} (${elapsed}s)`);
  }
}

export async function probeExecutable(binary, environment, timeoutMs = 10_000) {
  await new Promise((resolve, reject) => {
    let settled = false;
    const processHandle = spawn(binary, ['--version'], {
      shell: false,
      stdio: 'ignore',
      env: environment,
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (processHandle.exitCode === null && !processHandle.killed) processHandle.kill('SIGKILL');
      reject(new Error('Creality Print startup check timed out'));
    }, timeoutMs);
    processHandle.once('spawn', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (processHandle.exitCode === null && !processHandle.killed) processHandle.kill('SIGKILL');
      resolve();
    });
    processHandle.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}
