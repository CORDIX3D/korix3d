import { readFile } from 'node:fs/promises';
import process from 'node:process';

const example = await readFile('.env.example', 'utf8');
const workerExample = await readFile(
  'services/creality-slicer-worker/.env.example',
  'utf8'
);

const requiredSections = [
  'PUBLIC',
  'SEO',
  'SERVER',
  'SUPABASE',
  'STRIPE',
  'SMTP',
  'AI',
  'UPLOAD',
  'CREALITY',
  'MONITORING',
  'ANALYTICS',
  'CACHE',
];

const requiredApplicationVariables = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION',
  'NEXT_PUBLIC_BING_SITE_VERIFICATION',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CREALITY_SLICER_WORKER_PUBLIC_KEY',
  'CRON_SECRET',
];

const requiredWorkerVariables = [
  'KORIX3D_SITE_URL',
  'CREALITY_SLICER_WORKER_PRIVATE_KEY_PATH',
  'CREALITY_PRINT_BIN',
  'FREECAD_CMD_BIN',
  'CREALITY_MACHINE_PROFILE_PATH',
  'CREALITY_PROCESS_PROFILE_PATH',
  'CREALITY_FILAMENT_PROFILES_JSON',
  'SLICER_WORKER_ID',
  'CREALITY_PRINT_VERSION',
  'CREALITY_PRINTER_PROFILE',
  'CREALITY_PROCESS_PROFILE',
  'SLICER_POLL_INTERVAL_MS',
  'SLICER_JOB_TIMEOUT_MS',
  'SLICER_HTTP_TIMEOUT_MS',
  'STEP_CONVERTER_TIMEOUT_MS',
];

for (const section of requiredSections) {
  if (!example.includes(`# === ${section} ===`)) {
    throw new Error(`Brak sekcji ${section} w .env.example.`);
  }
}

function parseEnvironment(content) {
  return new Map(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

const applicationVariables = parseEnvironment(example);
const workerVariables = parseEnvironment(workerExample);

for (const name of requiredApplicationVariables) {
  if (!applicationVariables.has(name)) {
    throw new Error(`Brak zmiennej ${name} w .env.example.`);
  }
}

for (const name of requiredWorkerVariables) {
  if (!workerVariables.has(name)) {
    throw new Error(`Brak zmiennej ${name} w pliku środowiska workera.`);
  }
}

if (applicationVariables.get('NEXT_PUBLIC_SITE_URL') !== 'https://korix3d.pl') {
  throw new Error('NEXT_PUBLIC_SITE_URL musi wskazywać kanoniczną domenę produkcyjną.');
}

for (const secretName of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CREALITY_SLICER_WORKER_PUBLIC_KEY',
  'CRON_SECRET',
]) {
  if (applicationVariables.get(secretName) !== '') {
    throw new Error(`${secretName} musi pozostać bez wartości w repozytorium.`);
  }
}

if (/OPENAI|SENTRY_DSN|SMTP_PASSWORD/.test(example)) {
  throw new Error('Plik przykładowy nie może sugerować nieużywanych płatnych lub tajnych integracji.');
}

console.log(
  `Kontrakt środowiska jest kompletny: ${requiredSections.length} sekcji, `
  + `${requiredApplicationVariables.length} zmiennych aplikacji i `
  + `${requiredWorkerVariables.length} zmiennych workera.`
);
