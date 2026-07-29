import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const requiredDocuments = [
  ['README.md', ['## Uruchomienie lokalne', '## Kontrola przed wdrożeniem', '## Dokumentacja']],
  ['docs/WDROZENIE.md', ['## 2. Wymagane zmienne Vercel', '## 3. Supabase', '## 4. Vercel', '## 5. Stripe', '## 8. Staging, backup i rollback']],
  ['docs/ARCHITEKTURA.md', ['## Główne elementy', '## Krytyczne przepływy', '## Dane i migracje', '## Monitoring']],
  ['docs/BACKUP_I_ODTWARZANIE.md', ['## Harmonogram', '## Odtwarzanie', '## Migracje i istniejące dane']],
  ['docs/OPERACJE.md', ['## Checklista przed produkcją', '## Wdrożenie', '## Cofnięcie wdrożenia', '## Reagowanie na awarię']],
  ['docs/SUPABASE_PRODUCTION.md', ['## Ustawienia wymagane w panelu Supabase', '## Kontrolowane wdrożenie migracji', '## Kontrola zdalna']],
  ['docs/STRIPE_PRODUCTION.md', ['## Model płatności', '## Produkcyjny webhook', '## Przejście TEST → LIVE', '## Reakcja na błędy']],
  ['docs/VERCEL_PRODUCTION.md', ['## Projekt i źródło wdrożenia', '## Środowiska', '## Functions i Edge Runtime', '## Rollback']],
  ['docs/DOMENA_PRODUCTION.md', ['## Stan zweryfikowany 29 lipca 2026', '## Konfiguracja DNS i Vercel', '## HTTPS, SSL i HSTS', '## Kontrola po propagacji DNS']],
];

for (const [fileName, headings] of requiredDocuments) {
  const absolutePath = join(process.cwd(), fileName);
  await access(absolutePath);
  const content = await readFile(absolutePath, 'utf8');

  for (const heading of headings) {
    if (!content.includes(heading)) {
      throw new Error(`Brak wymaganej sekcji "${heading}" w ${fileName}.`);
    }
  }
}

console.log(`Dokumentacja operacyjna jest kompletna: ${requiredDocuments.length} plików.`);
