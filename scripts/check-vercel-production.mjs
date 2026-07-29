import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const nextConfig = await readFile(join(root, 'next.config.js'), 'utf8');
const middleware = await readFile(join(root, 'middleware.ts'), 'utf8');

const expectedVercel = {
  framework: 'nextjs',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  trailingSlash: false,
};

for (const [key, value] of Object.entries(expectedVercel)) {
  if (vercel[key] !== value) {
    throw new Error(`Nieprawidłowe vercel.json: ${key} musi mieć wartość ${String(value)}.`);
  }
}

if (!String(packageJson.engines?.node || '').startsWith('>=20.')) {
  throw new Error('Produkcja Vercel wymaga jawnie przypiętej głównej wersji Node.js 20.');
}

for (const header of [
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
]) {
  if (!nextConfig.includes(header)) {
    throw new Error(`Brak nagłówka produkcyjnego: ${header}.`);
  }
}

if (!middleware.includes("'Cache-Control': 'no-store'")) {
  throw new Error('Odpowiedzi chronionych tras nie wyłączają cache współdzielonego.');
}

console.log('Kontrakt wdrożenia Vercel jest kompletny.');
