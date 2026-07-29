import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const outputRoot = resolve(process.argv[2] || '');
const projectRoot = resolve(process.cwd());
const outputRelative = relative(projectRoot, outputRoot);

if (!process.argv[2]) throw new Error('Podaj katalog docelowy kopii Storage.');
if (!outputRelative.startsWith('..') && !isAbsolute(outputRelative)) {
  throw new Error('Kopia danych klientów musi znajdować się poza repozytorium.');
}

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!projectUrl || !serviceKey) {
  throw new Error('Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(projectUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const requiredBuckets = ['accounting-reports', 'product-images', 'quote-files'];
const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
if (bucketsError) throw bucketsError;

const availableBuckets = new Map((buckets || []).map((bucket) => [bucket.id, bucket]));
for (const required of requiredBuckets) {
  if (!availableBuckets.has(required)) throw new Error(`Brak bucketu ${required}.`);
}

function safeSegment(value) {
  return value && value !== '.' && value !== '..' && !/[\\/\0]/.test(value);
}

async function listFiles(bucketId, folder = '') {
  const files = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucketId)
      .list(folder, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const entries = data || [];
    for (const entry of entries) {
      if (!safeSegment(entry.name)) throw new Error('Storage zwrócił niebezpieczną nazwę obiektu.');
      const objectPath = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.metadata) files.push(objectPath);
      else files.push(...await listFiles(bucketId, objectPath));
    }
    if (entries.length < limit) break;
    offset += limit;
  }
  return files;
}

const storageRoot = join(outputRoot, 'storage');
await mkdir(storageRoot, { recursive: true });
const manifest = {
  format: 1,
  createdAt: new Date().toISOString(),
  projectHost: new URL(projectUrl).host,
  buckets: [],
  objects: [],
};

for (const bucket of buckets || []) {
  const bucketRoot = resolve(storageRoot, bucket.id);
  await mkdir(bucketRoot, { recursive: true });
  manifest.buckets.push({
    id: bucket.id,
    public: Boolean(bucket.public),
    fileSizeLimit: bucket.file_size_limit ?? null,
    allowedMimeTypes: bucket.allowed_mime_types ?? null,
  });

  for (const objectPath of await listFiles(bucket.id)) {
    const destination = resolve(bucketRoot, ...objectPath.split('/'));
    if (!destination.startsWith(`${bucketRoot}${sep}`)) {
      throw new Error('Odrzucono ścieżkę obiektu wychodzącą poza katalog kopii.');
    }
    const { data, error } = await supabase.storage.from(bucket.id).download(objectPath);
    if (error) throw error;
    const bytes = Buffer.from(await data.arrayBuffer());
    await mkdir(resolve(destination, '..'), { recursive: true });
    await writeFile(destination, bytes, { flag: 'wx' });
    manifest.objects.push({
      bucket: bucket.id,
      path: objectPath,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
}

await writeFile(
  join(outputRoot, 'storage-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: 'wx' }
);
console.log(`Kopia Storage: ${manifest.objects.length} obiektów z ${manifest.buckets.length} bucketów.`);
