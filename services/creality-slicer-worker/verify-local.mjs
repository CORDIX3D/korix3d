import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCrealityArguments,
  parseFilamentProfiles,
  parseGcode,
  runCrealityAndWait,
  selectFilamentProfile,
} from './worker-lib.mjs';
import { convertStepToStl } from './step-converter.mjs';

const required = [
  'CREALITY_PRINT_BIN',
  'FREECAD_CMD_BIN',
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
  let modelPath = inputPath;
  if (['.step', '.stp'].includes(inputPath.slice(inputPath.lastIndexOf('.')).toLowerCase())) {
    modelPath = join(directory, 'step-compatibility.stl');
    await convertStepToStl({
      binary: process.env.FREECAD_CMD_BIN,
      scriptPath: fileURLToPath(new URL('./freecad-step-to-stl.py', import.meta.url)),
      inputPath,
      outputPath: modelPath,
      environment: process.env,
      timeoutMs: 5 * 60_000,
    });
  }
  const args = buildCrealityArguments({
    machineProfilePath: process.env.CREALITY_MACHINE_PROFILE_PATH,
    processProfilePath: process.env.CREALITY_PROCESS_PROFILE_PATH,
    filamentProfilePath: selectFilamentProfile(profiles, process.argv[3] || 'PLA'),
    infillPercent: Number(process.argv[4] || 20),
    inputPath: modelPath,
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
