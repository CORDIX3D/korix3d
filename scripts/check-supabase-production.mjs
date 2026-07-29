import { readFile } from 'node:fs/promises';

const config = await readFile('supabase/config.toml', 'utf8');
const edgeSources = await Promise.all([
  readFile('supabase/functions/ai-analysis/index.ts', 'utf8'),
  readFile('supabase/functions/monthly-report/index.ts', 'utf8'),
]);

const requiredConfig = [
  'project_id = "korix3d"',
  '"https://korix3d.pl/auth/callback"',
  '"https://korix3d.pl/reset-password"',
  'enable_confirmations = true',
  '[functions.ai-analysis]',
  '[functions.monthly-report]',
];

for (const item of requiredConfig) {
  if (!config.includes(item)) {
    throw new Error(`Brak wymaganej konfiguracji Supabase: ${item}`);
  }
}

const jwtGuards = config.match(/verify_jwt\s*=\s*true/g) || [];
if (jwtGuards.length !== 2) {
  throw new Error('Obie Edge Functions muszą wymagać zweryfikowanego JWT.');
}

for (const source of edgeSources) {
  if (!source.includes('isAdminRequest') || !source.includes('isAllowedBrowserOrigin')) {
    throw new Error('Edge Function nie ma jawnej kontroli administratora lub origin.');
  }
  if (source.includes('Access-Control-Allow-Origin": "*"')) {
    throw new Error('Edge Function nadal zezwala na dowolny origin.');
  }
}

console.log('Konfiguracja Supabase, Auth i Edge Functions spełnia kontrakt produkcyjny.');
