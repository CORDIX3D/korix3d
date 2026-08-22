import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputDir] = process.argv.slice(2);
if (!inputPath || !outputDir) {
  throw new Error('Uzycie: node prepare-staging-restore.mjs <data.sql> <katalog-wyjsciowy>');
}

// Restore drill intentionally copies only public catalogue data. Tables that can
// contain customers, files, messages, API keys, contact details or recipients
// must never be exported to a shared staging environment.
const allowedTables = new Set([
  'public.blog_posts',
  'public.categories',
  'public.discount_codes',
  'public.faq_items',
  'public.filaments',
  'public.material_colors',
  'public.materials',
  'public.portfolio_items',
  'public.products',
  'public.warehouse_items',
]);

const forbiddenTables = new Set([
  'public.accounting_reports',
  'public.admin_audit_log',
  'public.ai_conversations',
  'public.ai_file_uploads',
  'public.ai_feedback',
  'public.ai_logs',
  'public.ai_messages',
  'public.ai_notifications',
  'public.ai_settings',
  'public.cart_items',
  'public.cms_content',
  'public.cms_pages',
  'public.cms_sections',
  'public.company_settings',
  'public.contact_submissions',
  'public.executive_reports',
  'public.messages',
  'public.newsletter_subscribers',
  'public.notifications',
  'public.orders_3d',
  'public.order_status_history',
  'public.icons',
  'public.product_reviews',
  'public.profiles',
  'public.public_api_rate_limits',
  'public.quote_settings',
  'public.report_recipients',
  'public.report_schedules',
  'public.settings',
  'public.slicer_workers',
  'public.slicing_jobs',
  'public.store_order_items',
  'public.store_orders',
  'public.stock_movements',
  'public.stripe_webhook_events',
  'public.wishlist_items',
]);

const excludedColumns = new Map([
  ['public.categories', new Set(['updated_at'])],
]);
const integerColumns = new Set([
  'public.products.weight_grams',
  'public.warehouse_items.weight_grams',
]);

function splitCopyFields(line) {
  const fields = [];
  let current = '';
  for (const char of line) {
    if (char === '\t') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function decodeCopyValue(raw) {
  if (raw === '\\N') return null;
  let value = '';
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== '\\') {
      value += char;
      continue;
    }

    index += 1;
    if (index >= raw.length) {
      value += '\\';
      break;
    }

    const escaped = raw[index];
    const named = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\' };
    if (Object.prototype.hasOwnProperty.call(named, escaped)) {
      value += named[escaped];
      continue;
    }

    if (/[0-7]/.test(escaped)) {
      let octal = escaped;
      while (octal.length < 3 && index + 1 < raw.length && /[0-7]/.test(raw[index + 1])) {
        index += 1;
        octal += raw[index];
      }
      value += String.fromCharCode(Number.parseInt(octal, 8));
      continue;
    }

    if (escaped === 'x' && index + 1 < raw.length && /[0-9a-f]/i.test(raw[index + 1])) {
      let hex = '';
      while (hex.length < 2 && index + 1 < raw.length && /[0-9a-f]/i.test(raw[index + 1])) {
        index += 1;
        hex += raw[index];
      }
      value += String.fromCharCode(Number.parseInt(hex, 16));
      continue;
    }

    value += escaped;
  }
  return value;
}

function sqlLiteral(raw, tableName, columnName) {
  const value = decodeCopyValue(raw);
  if (value === null) return 'NULL';
  if (integerColumns.has(`${tableName}.${columnName}`)) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Nieprawidlowa liczba w ${tableName}.${columnName}.`);
    }
    return String(Math.round(numericValue));
  }
  if (value.includes('\0')) throw new Error('SQL nie obsluguje bajtu NUL w literale tekstowym.');
  return `'${value.replaceAll("'", "''")}'`;
}

const source = fs.readFileSync(inputPath, 'utf8').replaceAll('\r\n', '\n');
const tables = [];
const excluded = new Map();
let current = null;

for (const line of source.split('\n')) {
  const start = line.match(/^COPY ([^ ]+) \((.+)\) FROM stdin;$/);
  if (start) {
    const tableName = start[1];
    current = {
      table: allowedTables.has(tableName) ? tableName : null,
      sourceTable: tableName,
      columnNames: start[2].split(',').map((column) => column.trim()),
      rows: [],
    };
    continue;
  }

  if (!current) continue;
  if (line === '\\.') {
    if (current.table) {
      tables.push(current);
    } else if (current.rows.length > 0) {
      excluded.set(current.sourceTable, current.rows.length);
    }
    current = null;
    continue;
  }
  current.rows.push(line);
}

const unexpectedPublicTables = [...excluded.keys()].filter(
  (tableName) => tableName.startsWith('public.') && !forbiddenTables.has(tableName),
);
if (unexpectedPublicTables.length > 0) {
  throw new Error(`Brak decyzji prywatnosci dla tabel: ${unexpectedPublicTables.join(', ')}`);
}

tables.sort((left, right) => left.table.localeCompare(right.table));
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const manifest = [];
let fileIndex = 0;
for (const table of tables) {
  if (table.rows.length === 0) {
    manifest.push({ table: table.table, rows: 0, chunks: [] });
    continue;
  }

  const chunks = [];
  const excludedForTable = excludedColumns.get(table.table) ?? new Set();
  const includedColumns = table.columnNames.filter((column) => !excludedForTable.has(column));
  let tuples = [];
  let approximateSize = 0;
  let chunkRows = 0;

  const flush = () => {
    if (tuples.length === 0) return;
    fileIndex += 1;
    const fileName = `${String(fileIndex).padStart(4, '0')}.sql`;
    const sql = [
      'BEGIN;',
      'SET LOCAL session_replication_role = replica;',
      `INSERT INTO ${table.table} (${includedColumns.join(', ')}) VALUES`,
      tuples.join(',\n'),
      'ON CONFLICT DO NOTHING;',
      'COMMIT;',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(outputDir, fileName), sql, { encoding: 'utf8', mode: 0o600 });
    chunks.push({ file: fileName, rows: chunkRows });
    tuples = [];
    approximateSize = 0;
    chunkRows = 0;
  };

  for (const row of table.rows) {
    const rawValues = splitCopyFields(row);
    if (rawValues.length !== table.columnNames.length) {
      throw new Error(`Niezgodna liczba kolumn w ${table.table}.`);
    }
    const values = table.columnNames
      .map((column, index) => ({ column, raw: rawValues[index] }))
      .filter(({ column }) => !excludedForTable.has(column))
      .map(({ column, raw }) => sqlLiteral(raw, table.table, column));
    const tuple = `(${values.join(',')})`;
    if (tuples.length > 0 && (tuples.length >= 100 || approximateSize + tuple.length > 200_000)) {
      flush();
    }
    tuples.push(tuple);
    approximateSize += tuple.length;
    chunkRows += 1;
  }
  flush();
  manifest.push({ table: table.table, rows: table.rows.length, chunks });
}

const excludedTables = [...excluded.entries()]
  .filter(([tableName]) => tableName.startsWith('public.'))
  .map(([table, rows]) => ({ table, rows }))
  .sort((left, right) => left.table.localeCompare(right.table));
const restoredRows = manifest.reduce((total, table) => total + table.rows, 0);
fs.writeFileSync(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), tables: manifest, excludedTables }, null, 2)}\n`,
  { encoding: 'utf8', mode: 0o600 },
);

process.stdout.write(JSON.stringify({
  tables: manifest.length,
  chunks: fileIndex,
  rows: restoredRows,
  excludedTables: excludedTables.length,
}));
