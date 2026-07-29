import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const backupRoot = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Podaj katalog kopii do sprawdzenia.');

for (const file of [
  'roles.sql',
  'schema.sql',
  'data.sql',
  'history_schema.sql',
  'history_data.sql',
  'storage-manifest.json',
  'config/supabase-config.toml',
  'config/vercel.json',
  'config/env-contract.example',
]) {
  const filePath = join(backupRoot, file);
  await access(filePath);
  if ((await stat(filePath)).size === 0) throw new Error(`Pusty plik kopii: ${file}`);
}

const manifest = JSON.parse(await readFile(join(backupRoot, 'storage-manifest.json'), 'utf8'));
if (manifest.format !== 1 || !Array.isArray(manifest.buckets) || !Array.isArray(manifest.objects)) {
  throw new Error('Nieobsługiwany manifest kopii Storage.');
}

const bucketIds = new Set(manifest.buckets.map((bucket) => bucket.id));
for (const required of ['accounting-reports', 'product-images', 'quote-files']) {
  if (!bucketIds.has(required)) throw new Error(`Manifest nie zawiera bucketu ${required}.`);
}

for (const object of manifest.objects) {
  const path = resolve(backupRoot, 'storage', object.bucket, ...object.path.split('/'));
  const relativePath = relative(resolve(backupRoot, 'storage'), path);
  if (relativePath.startsWith('..') || isAbsolute(relativePath) || !path.includes(sep)) {
    throw new Error('Manifest zawiera niebezpieczną ścieżkę.');
  }
  const bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== object.bytes || digest !== object.sha256) {
    throw new Error(`Niezgodna suma kontrolna: ${object.bucket}/${object.path}`);
  }
}

console.log(`Kopia jest kompletna: ${manifest.objects.length} obiektów Storage zweryfikowanych.`);
