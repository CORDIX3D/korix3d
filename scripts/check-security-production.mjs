import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const read = (path) => readFile(join(process.cwd(), path), 'utf8');
const [pkg, config, middleware, csrf, admin, webhook, files, signatures, rls, secrets, securityTxt, dependabot] = await Promise.all([
  read('package.json').then(JSON.parse),
  read('next.config.js'),
  read('middleware.ts'),
  read('lib/api/request-security.ts'),
  read('lib/api/admin-context.ts'),
  read('app/api/stripe/webhook/route.ts'),
  read('lib/quote-files.ts'),
  read('lib/quote-file-content.ts'),
  read('scripts/check-rls.mjs'),
  read('scripts/check-secrets.mjs'),
  read('public/.well-known/security.txt'),
  read('.github/dependabot.yml'),
]);

function versionAtLeast(value, required) {
  const left = String(value).replace(/^[^0-9]*/, '').split('.').map(Number);
  const right = required.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] || 0) > right[index]) return true;
    if ((left[index] || 0) < right[index]) return false;
  }
  return true;
}

if (!versionAtLeast(pkg.dependencies?.next, '15.5.21')) {
  throw new Error('Next.js jest starszy niż linia naprawiona w wydaniu bezpieczeństwa z lipca 2026.');
}
for (const header of [
  'Strict-Transport-Security', 'Content-Security-Policy', 'X-Content-Type-Options',
  'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy', 'X-Permitted-Cross-Domain-Policies',
]) {
  if (!config.includes(header)) throw new Error(`Brak nagłówka bezpieczeństwa: ${header}`);
}
for (const directive of ["object-src 'none'", "frame-ancestors 'none'", "frame-src 'none'", 'upgrade-insecure-requests']) {
  if (!config.includes(directive)) throw new Error(`Brak dyrektywy CSP: ${directive}`);
}
if (!middleware.includes('getUser()') || !middleware.includes('canAccessAdminPath')) {
  throw new Error('Middleware nie potwierdza użytkownika i zakresu roli.');
}
if (!csrf.includes("fetchSite === 'same-origin'") || !csrf.includes('new URL(origin).origin')) {
  throw new Error('Mutacje nie wymagają zaufanego Origin/Sec-Fetch-Site.');
}
if (!admin.includes("profile?.role !== 'admin'") || !admin.includes('createServiceRoleClient')) {
  throw new Error('Admin API nie oddziela sesji użytkownika od service role.');
}
for (const marker of ['stripe-signature', 'constructEvent(', 'MAX_WEBHOOK_BYTES', 'claim_stripe_webhook_event']) {
  if (!webhook.includes(marker)) throw new Error(`Webhook Stripe nie ma zabezpieczenia: ${marker}`);
}
for (const marker of ['MAX_QUOTE_FILE_BYTES', 'MAX_QUOTE_TOTAL_BYTES', 'MAX_QUOTE_FILES']) {
  if (!files.includes(marker)) throw new Error(`Upload nie ma limitu: ${marker}`);
}
if (!signatures.includes('validateQuoteFileSignature')) throw new Error('Upload nie sprawdza sygnatur plików.');
if (!rls.includes('serviceOnlyFunctions') || !rls.includes('missingRls')) throw new Error('Kontrola RLS jest niepełna.');
for (const pattern of ['sk|rk', 'sk-', 'sbp_', 'whsec_']) {
  if (!secrets.includes(pattern)) throw new Error(`Skan sekretów nie obejmuje: ${pattern}`);
}
if (!securityTxt.includes('mailto:kontakt@korix3d.pl') || !securityTxt.includes('Canonical:')) {
  throw new Error('security.txt jest niekompletny.');
}
if (!dependabot.includes('package-ecosystem: npm') || !dependabot.includes('package-ecosystem: github-actions')) {
  throw new Error('Dependabot nie obejmuje npm i GitHub Actions.');
}

console.log('Kontrakt bezpieczeństwa produkcyjnego jest kompletny.');
