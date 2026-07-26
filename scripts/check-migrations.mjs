import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const directory = join(process.cwd(), 'supabase', 'migrations');
const fileNames = (await readdir(directory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (fileNames.length === 0) {
  throw new Error('Nie znaleziono migracji Supabase.');
}

const versionPattern = /^(\d{14})_[a-z0-9_.-]+\.sql$/i;
const versions = new Set();
const migrations = [];

for (const fileName of fileNames) {
  const match = fileName.match(versionPattern);
  if (!match) throw new Error(`Nieprawidłowa nazwa migracji: ${fileName}`);
  if (versions.has(match[1])) {
    throw new Error(`Powtórzony numer migracji: ${match[1]}`);
  }
  versions.add(match[1]);
  migrations.push({
    fileName,
    sql: (await readFile(join(directory, fileName), 'utf8')).toLowerCase(),
  });
}

for (const migration of migrations) {
  const dollarQuoteCount = migration.sql.match(/\$\$/g)?.length || 0;
  if (dollarQuoteCount % 2 !== 0) {
    throw new Error(`Niedomknięty blok SQL w migracji: ${migration.fileName}`);
  }
}

const requiredBaseTables = [
  'profiles',
  'materials',
  'material_colors',
  'categories',
  'products',
  'filaments',
  'warehouse_items',
  'orders_3d',
  'cart_items',
  'wishlist_items',
  'store_orders',
  'store_order_items',
  'product_reviews',
  'notifications',
  'blog_posts',
  'faq_items',
  'settings',
  'discount_codes',
  'messages',
  'contact_submissions',
  'portfolio_items',
  'order_status_history',
  'filament_usage_log',
];
const firstMigration = migrations[0];

for (const table of requiredBaseTables) {
  const createPattern = new RegExp(
    `create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\b`
  );
  if (!createPattern.test(firstMigration.sql)) {
    throw new Error(
      `Pierwsza migracja ${firstMigration.fileName} nie tworzy tabeli ${table}.`
    );
  }
}

const allSql = migrations.map((migration) => migration.sql).join('\n');
const applicationTables = [
  ...requiredBaseTables,
  'accounting_reports',
  'admin_audit_log',
  'ai_conversations',
  'ai_file_uploads',
  'ai_logs',
  'ai_messages',
  'ai_notifications',
  'ai_scores_history',
  'ai_settings',
  'executive_reports',
  'monthly_trends',
  'newsletter_subscribers',
  'public_api_rate_limits',
  'slicer_workers',
  'slicing_jobs',
  'stock_movements',
];

for (const table of applicationTables) {
  const createPattern = new RegExp(
    `create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\b`
  );
  if (!createPattern.test(allSql)) {
    throw new Error(`Brak migracji tworzącej tabelę używaną przez aplikację: ${table}.`);
  }
}

const requiredSecurityGuards = [
  {
    name: 'limit przesyłania plików wyceny',
    sql: 'create or replace function public.can_upload_quote_file',
  },
  {
    name: 'weryfikacja obiektów plików wyceny',
    sql: 'create or replace function public.validate_order_3d_file_objects',
  },
  {
    name: 'ochrona sfinalizowanych plików wyceny',
    sql: 'create policy quote_files_owner_delete',
  },
  {
    name: 'ukrycie wewnętrznych kolumn produktu',
    sql: 'revoke select on public.products from anon, authenticated',
  },
  {
    name: 'ukrycie wewnętrznego cennika wycen',
    sql: "category in ('general', 'shipping', 'social', 'seo')",
  },
];

for (const guard of requiredSecurityGuards) {
  if (!allSql.includes(guard.sql)) {
    throw new Error(`Brak zabezpieczenia migracji: ${guard.name}.`);
  }
}

console.log(
  `Migracje Supabase są spójne statycznie: ${migrations.length} plików, ${applicationTables.length} wymaganych tabel.`
);
