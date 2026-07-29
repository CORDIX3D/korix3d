import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const layout = await readFile(join(root, 'app/layout.tsx'), 'utf8');
const robots = await readFile(join(root, 'app/robots.ts'), 'utf8');
const sitemap = await readFile(join(root, 'app/sitemap.ts'), 'utf8');
const nextConfig = await readFile(join(root, 'next.config.js'), 'utf8');
const manifest = JSON.parse(await readFile(join(root, 'public/site.webmanifest'), 'utf8'));

for (const requirement of [
  "metadataBase: new URL('https://korix3d.pl')",
  "manifest: '/site.webmanifest'",
  "apple: '/apple-touch-icon.png'",
]) {
  if (!layout.includes(requirement)) {
    throw new Error(`Brak ustawienia domeny w metadanych: ${requirement}`);
  }
}

for (const requirement of [
  "value: 'www.korix3d.pl'",
  "destination: 'https://korix3d.pl/:path*'",
  'permanent: true',
  'Strict-Transport-Security',
]) {
  if (!nextConfig.includes(requirement)) {
    throw new Error(`Brak ustawienia domeny w next.config.js: ${requirement}`);
  }
}

if (!robots.includes("const SITE_URL = 'https://korix3d.pl'")) {
  throw new Error('robots.txt nie wskazuje domeny kanonicznej.');
}
if (!sitemap.includes("{ path: '/sklep'") || !sitemap.includes('absoluteSiteUrl(')) {
  throw new Error('Sitemap nie zawiera publicznych stron i adresów kanonicznych.');
}

if (
  manifest.name !== 'KORIX3D'
  || manifest.start_url !== '/'
  || manifest.display !== 'standalone'
) {
  throw new Error('Manifest aplikacji ma niepełne dane produkcyjne.');
}

for (const asset of [
  'public/favicon.ico',
  'public/favicon-16x16.png',
  'public/favicon-32x32.png',
  'public/apple-touch-icon.png',
  'public/icon-192x192.png',
  'public/icon-512x512.png',
]) {
  await access(join(root, asset));
}

console.log('Kontrakt domeny, SEO technicznego i ikon jest kompletny.');
