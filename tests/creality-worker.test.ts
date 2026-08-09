import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildCrealityArguments,
  parseFilamentProfiles,
  parseGcode,
  probeExecutable,
  selectFilamentProfile,
} from '../services/creality-slicer-worker/worker-lib.mjs';
import { startWorkerDashboard } from '../services/creality-slicer-worker/dashboard.mjs';

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

test('worker sprawdza możliwość uruchomienia programu przed pobraniem zadania', async () => {
  await probeExecutable(process.execPath, process.env, 5_000);
});

test('lokalny dashboard workera udostępnia stan i dane produkcji tylko na loopback', async () => {
  const server = await startWorkerDashboard({
    port: 0,
    getRuntimeState: () => ({ status: 'idle' }),
    getOverview: async () => ({ summary: { pending_calculations: 2 } }),
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    assert.equal(address.address, '127.0.0.1');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/state`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      runtime: { status: 'idle' },
      overview: { summary: { pending_calculations: 2 } },
    });
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
