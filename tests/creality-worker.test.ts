import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildCrealityArguments,
  parseFilamentProfiles,
  parseGcode,
  selectFilamentProfile,
} from '../services/creality-slicer-worker/worker-lib.mjs';

test('worker buduje oficjalne argumenty CLI Creality Print 7.1', () => {
  const args = buildCrealityArguments({
    machineProfilePath: 'machine.json',
    processProfilePath: 'process.json',
    filamentProfilePath: 'pla.json',
    infillPercent: 20,
    inputPath: 'model.stl',
    outputDirectory: 'output',
  });

  assert.deepEqual(args, [
    '--load-settings',
    'machine.json;process.json',
    '--load-filaments',
    'pla.json',
    '--sparse-infill-density',
    '20%',
    '--slice',
    '0',
    '--outputdir',
    'output',
    'model.stl',
  ]);
});

test('worker wybiera profil filamentu bez względu na wielkość liter', () => {
  const profiles = parseFilamentProfiles('{"PLA":"pla.json","PETG":"petg.json"}');
  assert.equal(selectFilamentProfile(profiles, 'pla'), 'pla.json');
  assert.equal(selectFilamentProfile(profiles, ' PETG '), 'petg.json');
  assert.throws(() => selectFilamentProfile(profiles, 'ABS'), /No Creality filament profile/);
});

test('worker odczytuje realne metadane G-code z Creality Print', () => {
  const parsed = parseGcode(`
; total layer number: 50
; filament used [g] = 0.66
; total layers count = 50
; estimated printing time (normal mode) = 2m 54s
`);
  assert.deepEqual(parsed, {
    printing_time_seconds: 174,
    filament_used_grams: 0.66,
    layer_count: 50,
  });
});
