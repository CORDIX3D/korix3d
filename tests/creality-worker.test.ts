import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { test } from 'vitest';
import {
  buildCrealityArguments,
  parseFilamentProfiles,
  parseGcode,
  probeExecutable,
  selectFilamentProfile,
} from '../services/creality-slicer-worker/worker-lib.mjs';
import { startWorkerDashboard } from '../services/creality-slicer-worker/dashboard.mjs';
import { convert3mfToBinaryStl } from '../services/creality-slicer-worker/three-mf-to-stl.mjs';
import { convert3mfInWorker } from '../services/creality-slicer-worker/three-mf-converter-client.mjs';

test('worker konwertuje standardowy model 3MF do binarnego STL z zachowaniem skali', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'korix3d-3mf-test-'));
  const inputPath = join(directory, 'model.3mf');
  const outputPath = join(directory, 'model.stl');
  const zip = new JSZip();
  zip.file('3D/3dmodel.model', `<?xml version="1.0" encoding="UTF-8"?>
    <model unit="centimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
      <resources><object id="1" type="model"><mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh></object></resources>
      <build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 2 3 4"/></build>
    </model>`);
  await writeFile(inputPath, await zip.generateAsync({ type: 'nodebuffer' }));

  try {
    const result = await convert3mfToBinaryStl(inputPath, outputPath);
    const stl = await readFile(outputPath);
    assert.deepEqual(result, { triangleCount: 1 });
    assert.equal(stl.readUInt32LE(80), 1);
    assert.equal(stl.length, 134);
    assert.deepEqual(
      [stl.readFloatLE(96), stl.readFloatLE(100), stl.readFloatLE(104)],
      [20, 30, 40]
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('worker konwertuje wieloczęściowy 3MF z odwołaniem do zewnętrznego modelu', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'korix3d-3mf-parts-test-'));
  const inputPath = join(directory, 'model.3mf');
  const outputPath = join(directory, 'model.stl');
  const zip = new JSZip();
  zip.file('3D/3dmodel.model', `<?xml version="1.0" encoding="UTF-8"?>
    <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
      xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">
      <resources><object id="2" type="model"><components>
        <component objectid="1" p:path="/3D/Objects/mesh.model" transform="1 0 0 0 1 0 0 0 1 5 6 7"/>
      </components></object></resources>
      <build><item objectid="2"/></build>
    </model>`);
  zip.file('3D/Objects/mesh.model', `<?xml version="1.0" encoding="UTF-8"?>
    <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
      <resources><object id="1" type="model"><mesh>
        <vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh></object></resources><build/>
    </model>`);
  await writeFile(inputPath, await zip.generateAsync({ type: 'nodebuffer' }));

  try {
    const result = await convert3mfToBinaryStl(inputPath, outputPath);
    const stl = await readFile(outputPath);
    assert.deepEqual(result, { triangleCount: 1 });
    assert.deepEqual(
      [stl.readFloatLE(96), stl.readFloatLE(100), stl.readFloatLE(104)],
      [5, 6, 7]
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('worker izoluje konwersję 3MF od heartbeat i panelu', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'korix3d-3mf-worker-test-'));
  const inputPath = join(directory, 'model.3mf');
  const outputPath = join(directory, 'model.stl');
  const zip = new JSZip();
  zip.file('3D/3dmodel.model', `<?xml version="1.0" encoding="UTF-8"?>
    <model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
      <resources><object id="1" type="model"><mesh>
        <vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>
        <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
      </mesh></object></resources><build><item objectid="1"/></build>
    </model>`);
  await writeFile(inputPath, await zip.generateAsync({ type: 'nodebuffer' }));

  try {
    assert.deepEqual(
      await convert3mfInWorker(inputPath, outputPath, 5_000),
      { triangleCount: 1 }
    );
    assert.equal((await readFile(outputPath)).readUInt32LE(80), 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
    '--no-check',
    '--allow-newer-file',
    '--arrange',
    '1',
    '--orient',
    '1',
    '--ensure-on-bed',
    '--allow-multicolor-oneplate',
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
