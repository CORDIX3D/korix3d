import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const manifestPath = path.join(process.cwd(), '.next', 'app-build-manifest.json');
const maximumRouteBytes = 1_250_000;

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {
  console.error('Brak manifestu buildu. Najpierw uruchom npm run build.');
  process.exit(1);
}

const results = [];
for (const [route, files] of Object.entries(manifest.pages || {})) {
  if (route.includes('/api/') || route.endsWith('/route')) continue;
  let bytes = 0;
  for (const file of new Set(files)) {
    if (!file.endsWith('.js')) continue;
    try {
      bytes += (await stat(path.join(process.cwd(), '.next', file))).size;
    } catch {
      // Pomijamy wpisy, których Next nie zapisał jako osobnego pliku.
    }
  }
  results.push({ route, bytes });
}

results.sort((left, right) => right.bytes - left.bytes);
for (const result of results.slice(0, 8)) {
  console.log(`${(result.bytes / 1024).toFixed(1)} KB\t${result.route}`);
}

const oversized = results.filter((result) => result.bytes > maximumRouteBytes);
if (oversized.length > 0) {
  console.error(`Przekroczono budżet ${(maximumRouteBytes / 1024).toFixed(0)} KB dla ${oversized.length} tras.`);
  process.exit(1);
}

console.log(`Budżet JavaScript jest zachowany dla ${results.length} tras.`);
