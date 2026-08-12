import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const read = (path) => readFile(join(process.cwd(), path), 'utf8');

const [nextConfig, image, ai, home, shop, blog, faq, blogDetail, portfolioDetail, bundle] = await Promise.all([
  read('next.config.js'),
  read('components/ui/optimized-image.tsx'),
  read('components/ai/ai-wrapper.tsx'),
  read('app/(public)/page.tsx'),
  read('app/(public)/sklep/page.tsx'),
  read('app/(public)/blog/page.tsx'),
  read('app/(public)/faq/page.tsx'),
  read('app/(public)/blog/[slug]/page.tsx'),
  read('app/(public)/portfolio/[id]/page.tsx'),
  read('scripts/check-bundle-size.mjs'),
]);

if (!nextConfig.includes("formats: ['image/avif', 'image/webp']") || !nextConfig.includes('minimumCacheTTL')) {
  throw new Error('Brak produkcyjnej optymalizacji obrazów Next.js.');
}
if (!image.includes("from 'next/image'") || !image.includes('sizes=')) {
  throw new Error('Komponent obrazów nie korzysta poprawnie z next/image i sizes.');
}
if (!ai.includes("from 'next/dynamic'") || !ai.includes('ssr: false') || !ai.includes('requested')) {
  throw new Error('Asystent AI nie jest ładowany na żądanie.');
}
if (home.includes("'use client'") || !home.includes('export const revalidate = 300')) {
  throw new Error('Strona główna musi pozostać renderowana serwerowo z okresowym odświeżaniem danych.');
}
for (const [name, source] of [['sklep', shop], ['blog', blog], ['FAQ', faq]]) {
  if (source.includes(".select('*')")) throw new Error(`${name}: publiczne zapytanie nadal pobiera wszystkie kolumny.`);
}
for (const [name, source] of [['artykuł', blogDetail], ['portfolio', portfolioDetail]]) {
  if (!source.includes("from 'react'") || !source.includes('cache(async')) {
    throw new Error(`${name}: metadane i treść nie współdzielą zapytania.`);
  }
}
if (!bundle.includes("return 1_200_000") || !bundle.includes('return 900_000')) {
  throw new Error('Brak osobnych budżetów JavaScript dla panelu i tras publicznych.');
}

console.log('Kontrakt wydajności produkcyjnej jest kompletny.');
