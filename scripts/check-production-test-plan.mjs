import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const smoke = await readFile(join(root, 'e2e-production/read-only.spec.ts'), 'utf8');
const workflow = await readFile(join(root, '.github/workflows/production-smoke.yml'), 'utf8');
const report = await readFile(join(root, 'docs/PRODUCTION_TESTS.md'), 'utf8');

for (const requirement of [
  'www.korix3d.pl',
  '/api/health',
  '/robots.txt',
  '/sitemap.xml',
  '/site.webmanifest',
  "'/sklep'",
  "'/wycena'",
  "'/panel'",
  "'/admin'",
  'Nie znaleziono strony',
]) {
  if (!smoke.includes(requirement)) throw new Error(`Smoke test nie obejmuje: ${requirement}`);
}
if (!workflow.includes('workflow_dispatch:') || !workflow.includes('playwright.production.config.ts')) {
  throw new Error('Brak ręcznego, bezpiecznego workflow testów produkcyjnych.');
}

for (const area of [
  'Rejestracja', 'Logowanie', 'Reset hasła', 'Dodanie produktu', 'Koszyk',
  'Kupon', 'Checkout', 'Stripe', 'Webhook', 'Zamówienie', 'Magazyn',
  'Panel klienta', 'Panel administratora', 'Upload STL', 'Kalkulator',
  'Blog', 'Kontakt', 'Wyszukiwarka', 'AI', 'Raporty',
]) {
  if (!report.includes(`| ${area} |`)) throw new Error(`Macierz odbioru nie obejmuje: ${area}`);
}

console.log('Plan testów produkcyjnych obejmuje wszystkie wymagane obszary.');
