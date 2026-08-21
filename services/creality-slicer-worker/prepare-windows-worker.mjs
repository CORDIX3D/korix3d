import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error('Podaj prywatny katalog konfiguracji poza repozytorium.');
}

const outputDir = path.resolve(outputArgument);
const privateKeyPath = path.join(outputDir, 'worker-private-key.pem');
const publicKeyPath = path.join(outputDir, 'worker-public-key.pem');
const environmentPath = path.join(outputDir, 'worker.env');
const crealityRoot = 'C:\\Program Files\\Creality\\Creality Print 7.1';
const printerName = 'Creality Ender-3 V3 Plus 0.4 nozzle';

await mkdir(outputDir, { recursive: true, mode: 0o700 });

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const filamentProfiles = JSON.stringify({
  PLA: `${crealityRoot}\\resources\\profiles\\Creality\\filament\\Generic PLA @${printerName}.json`,
  PETG: `${crealityRoot}\\resources\\profiles\\Creality\\filament\\Generic PETG @${printerName}.json`,
});
const environment = [
  'KORIX3D_SITE_URL=https://korix3d.pl',
  `CREALITY_SLICER_WORKER_PRIVATE_KEY_PATH=${privateKeyPath}`,
  `CREALITY_PRINT_BIN=${crealityRoot}\\CrealityPrint.exe`,
  'FREECAD_CMD_BIN=C:\\Program Files\\FreeCAD 1.1\\bin\\FreeCADCmd.exe',
  `CREALITY_MACHINE_PROFILE_PATH=${crealityRoot}\\resources\\profiles\\Creality\\machine\\${printerName}.json`,
  `CREALITY_PROCESS_PROFILE_PATH=${crealityRoot}\\resources\\profiles\\Creality\\process\\0.20mm Standard @${printerName}.json`,
  `CREALITY_FILAMENT_PROFILES_JSON=${filamentProfiles}`,
  'SLICER_WORKER_ID=creality-production-1',
  'CREALITY_PRINT_VERSION=7.1',
  `CREALITY_PRINTER_PROFILE=${printerName}`,
  'CREALITY_PROCESS_PROFILE=0.20mm Standard',
  'SLICER_POLL_INTERVAL_MS=5000',
  'SLICER_JOB_TIMEOUT_MS=720000',
  'SLICER_HTTP_TIMEOUT_MS=60000',
  'STEP_CONVERTER_TIMEOUT_MS=300000',
  'SLICER_DASHBOARD_PORT=4317',
  '',
].join('\n');

try {
  await writeFile(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await writeFile(publicKeyPath, publicKey, { encoding: 'utf8', mode: 0o644, flag: 'wx' });
  await writeFile(environmentPath, environment, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
} catch (error) {
  if (error?.code === 'EEXIST') {
    throw new Error('Konfiguracja workera już istnieje. Rotację wykonaj do nowego katalogu.');
  }
  throw error;
}

process.stdout.write(JSON.stringify({
  privateKeyPath,
  publicKeyPath,
  environmentPath,
  publicKeyVariable: 'CREALITY_SLICER_WORKER_PUBLIC_KEY',
}));
