import { readFile } from 'node:fs/promises';

const report = await readFile('PRODUCTION_READY_REPORT.md', 'utf8');

for (const heading of [
  '## Werdykt',
  '## Podsumowanie wykonawcze',
  '## Stan 15 etapów',
  '## Wyniki komend',
  '## Testy działającej witryny',
  '## Krytyczne blokady przed produkcją',
  '## Kolejność bezpiecznego uruchomienia',
  '## Git i wdrożenie',
  '## Sekrety i koszty',
  '## Kryterium „production ready”',
]) {
  if (!report.includes(heading)) throw new Error(`Raport nie zawiera sekcji: ${heading}`);
}

for (let stage = 1; stage <= 15; stage += 1) {
  if (!report.includes(`| ${stage} |`)) throw new Error(`Raport nie obejmuje etapu ${stage}.`);
}

if (
  !report.includes('NIEGOTOWE DO PEŁNEJ PRODUKCJI')
  && !report.includes('GOTOWE DO KONTROLOWANEGO URUCHOMIENIA PRODUKCYJNEGO')
) {
  throw new Error('Raport nie przedstawia jednoznacznego werdyktu.');
}
if (!report.includes('KORIX AI nie używa OpenAI')) {
  throw new Error('Raport nie potwierdza bezkosztowego trybu AI.');
}
if (/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b|\bsbp_[A-Za-z0-9]{16,}\b|\bwhsec_[A-Za-z0-9]{16,}\b/.test(report)) {
  throw new Error('Raport zawiera wartość przypominającą sekret.');
}

console.log('Raport gotowości produkcyjnej obejmuje 15 etapów i jednoznaczny werdykt.');
