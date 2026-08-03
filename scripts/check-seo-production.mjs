import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const read = (path) => readFile(join(process.cwd(), path), 'utf8');
const [layout, seo, sitemap, robots, product, blog, portfolio, material, faq, env, manifest] = await Promise.all([
  read('app/layout.tsx'),
  read('lib/seo.ts'),
  read('app/sitemap.ts'),
  read('app/robots.ts'),
  read('app/(public)/sklep/[slug]/page.tsx'),
  read('app/(public)/blog/[slug]/page.tsx'),
  read('app/(public)/portfolio/[id]/page.tsx'),
  read('app/(public)/materialy/[slug]/page.tsx'),
  read('app/(public)/faq/page.tsx'),
  read('.env.example'),
  read('public/site.webmanifest'),
]);

for (const marker of ["'@type': 'Organization'", "'@type': 'LocalBusiness'", 'metadataBase', 'verification:']) {
  if (!layout.includes(marker)) throw new Error(`Brak globalnego SEO: ${marker}`);
}
if (!product.includes("'@type': 'Product'") || !product.includes("'@type': 'Offer'")) {
  throw new Error('Brak danych Product/Offer.');
}
if (!blog.includes("'@type': 'Article'")) throw new Error('Brak danych Article.');
if (!faq.includes("'@type': 'FAQPage'")) throw new Error('Brak danych FAQPage.');
if (!seo.includes("'@type': 'BreadcrumbList'")) throw new Error('Brak generatora BreadcrumbList.');
for (const [name, source] of [['produkt', product], ['artykuł', blog], ['portfolio', portfolio], ['materiał', material]]) {
  if (!source.includes('breadcrumbJsonLd(')) throw new Error(`${name}: brak breadcrumbs.`);
}
for (const marker of ['products', 'blog_posts', 'materials', 'portfolio_items']) {
  if (!sitemap.includes(marker)) throw new Error(`Sitemap nie obejmuje: ${marker}`);
}
for (const marker of ["'/admin/'", "'/panel/'", "'/checkout'"]) {
  if (!robots.includes(marker)) throw new Error(`robots.txt nie blokuje: ${marker}`);
}
for (const marker of ['NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION', 'NEXT_PUBLIC_BING_SITE_VERIFICATION']) {
  if (!env.includes(`${marker}=`)) throw new Error(`Brak zmiennej SEO: ${marker}`);
}
const parsedManifest = JSON.parse(manifest);
if (parsedManifest.lang !== 'pl' || parsedManifest.scope !== '/') throw new Error('Manifest nie ma języka lub scope.');

console.log('Kontrakt SEO produkcyjnego jest kompletny.');
