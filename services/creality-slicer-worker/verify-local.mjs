import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildCrealityArguments,
  parseFilamentProfiles,
  parseGcode,
  runCrealityAndWait,
  selectFilamentProfile,
} from './worker-lib.mjs';

const required = [
  'CREALITY_PRINT_BIN',
  'CREALITY_MACHINE_PROFILE_PATH',
  'CREALITY_PROCESS_PROFILE_PATH',
  'CREALITY_FILAMENT_PROFILES_JSON',
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const directory = await mkdtemp(join(tmpdir(), 'korix3d-creality-check-'));
try {
  const profiles = parseFilamentProfiles(process.env.CREALITY_FILAMENT_PROFILES_JSON);
  const inputPath = resolve(
    process.argv[2] || 'services/creality-slicer-worker/fixtures/calibration-cube-10mm.stl'
  );
  const args = buildCrealityArguments({
    machineProfilePath: process.env.CREALITY_MACHINE_PROFILE_PATH,
    processProfilePath: process.env.CREALITY_PROCESS_PROFILE_PATH,
    filamentProfilePath: selectFilamentProfile(profiles, process.argv[3] || 'PLA'),
    infillPercent: Number(process.argv[4] || 20),
    inputPath,
    outputDirectory: directory,
  });
  const gcodePath = await runCrealityAndWait({
    binary: process.env.CREALITY_PRINT_BIN,
    args,
    outputDirectory: directory,
    environment: process.env,
    timeoutMs: 5 * 60_000,
  });
  process.stdout.write(`${JSON.stringify(parseGcode(await readFile(gcodePath, 'utf8')))}\n`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
