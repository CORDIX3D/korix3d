import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDirectory = join(process.cwd(), 'supabase', 'migrations');
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();
const sql = (
  await Promise.all(
    migrationFiles.map((name) => readFile(join(migrationsDirectory, name), 'utf8'))
  )
).join('\n');
const normalizedSql = sql.toLowerCase();

function matches(pattern) {
  return [...normalizedSql.matchAll(pattern)].map((match) => match[1]);
}

const createdTables = new Set(
  matches(/create\s+table\s+if\s+not\s+exists\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)
);
const rlsTables = new Set(
  matches(/alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi)
);
const missingRls = [...createdTables].filter((table) => !rlsTables.has(table));

if (missingRls.length > 0) {
  throw new Error(`Tabele bez włączonego RLS: ${missingRls.join(', ')}`);
}

const requiredGuards = [
  ['ochrona roli profilu', 'create trigger profiles_protect_privileges'],
  ['odczyt własnych zamówień sklepu', 'create policy store_orders_user_read'],
  ['odczyt własnych pozycji zamówienia', 'create policy store_order_items_via_order'],
  ['blokada bezpośredniego tworzenia zamówienia sklepu', 'create policy store_orders_admin_insert'],
  ['blokada bezpośredniego tworzenia wyceny', 'create policy orders_3d_insert_admin'],
  ['ochrona statusu płatności', 'store order payment status requires service role'],
  ['ochrona warunków checkoutu', 'store order checkout terms are protected'],
  ['ukrycie księgowości', 'create policy "admin_all_accounting_reports"'],
  ['ukrycie kodów rabatowych', 'revoke all on public.discount_codes from anon, authenticated'],
  ['ukrycie kosztów produktu', 'revoke select on public.products from anon, authenticated'],
  ['ukrycie kosztów wyceny', 'revoke select on public.orders_3d from anon, authenticated'],
  ['magazyn wyłącznie dla pracowników', 'create policy stock_movements_staff_read'],
  ['prywatne webhooki Stripe', 'revoke all on public.stripe_webhook_events from anon, authenticated'],
  ['utwardzony helper administratora', 'create or replace function public.is_admin()'],
  ['utwardzony helper pracownika', 'create or replace function public.is_employee()'],
];

for (const [name, fragment] of requiredGuards) {
  if (!normalizedSql.includes(fragment)) {
    throw new Error(`Brak zabezpieczenia RLS: ${name}.`);
  }
}

const serviceOnlyFunctions = [
  'cancel_store_order_and_restore_stock',
  'cancel_store_order_and_restore_stock_locked',
  'claim_slicing_job',
  'claim_stripe_webhook_event',
  'consume_public_api_rate_limit',
  'create_store_order_with_stock',
  'create_store_order_with_stock_locked',
  'fail_stripe_webhook_event',
  'finish_slicing_job',
  'finish_stripe_webhook_event',
];

for (const functionName of serviceOnlyFunctions) {
  const revokePattern = new RegExp(
    `revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\s*\\(`,
    'i'
  );
  const grantPattern = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?\\)\\s+to\\s+service_role`,
    'i'
  );
  if (!revokePattern.test(sql) || !grantPattern.test(sql)) {
    throw new Error(`Funkcja ${functionName} nie jest ograniczona do service_role.`);
  }
}

console.log(
  `RLS jest obecny dla ${createdTables.size} tabel; krytyczne polityki i funkcje service_role są zabezpieczone.`
);
