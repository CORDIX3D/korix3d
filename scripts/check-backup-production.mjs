import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const runner = await readFile(join(root, 'scripts/backup/backup-production.ps1'), 'utf8');
const storage = await readFile(join(root, 'scripts/backup/backup-storage.mjs'), 'utf8');
const verifier = await readFile(join(root, 'scripts/backup/verify-backup.mjs'), 'utf8');
const encryptedVerifier = await readFile(join(root, 'scripts/backup/verify-encrypted-backup.ps1'), 'utf8');
const docs = await readFile(join(root, 'docs/BACKUP_I_ODTWARZANIE.md'), 'utf8');

for (const requirement of ['--role-only', '--data-only', '--use-copy', 'supabase_migrations']) {
  if (!runner.includes(requirement)) throw new Error(`Backup bazy nie zawiera: ${requirement}`);
}
for (const requirement of ['storage.listBuckets()', '.download(objectPath)', "createHash('sha256')"] ) {
  if (!storage.includes(requirement)) throw new Error(`Backup Storage nie zawiera: ${requirement}`);
}
for (const requirement of ['storage-manifest.json', 'accounting-reports', 'product-images', 'quote-files']) {
  if (!verifier.includes(requirement)) throw new Error(`Weryfikator kopii nie sprawdza: ${requirement}`);
}
for (const requirement of ['KORIX3D_BACKUP_AGE_RECIPIENT', '--recipient', 'finally', 'Remove-Item', '.sha256']) {
  if (!runner.includes(requirement)) throw new Error(`Backup nie wymusza bezpiecznego szyfrowania: ${requirement}`);
}
for (const requirement of ['KORIX3D_BACKUP_AGE_IDENTITY', '--decrypt', 'verify-backup.mjs', 'Get-FileHash', "StartsWith('/')", "Contains('..')"]) {
  if (!encryptedVerifier.includes(requirement)) throw new Error(`Test zaszyfrowanej kopii nie zawiera: ${requirement}`);
}
for (const heading of ['## Backup konfiguracji i sekretów', '## Test odtworzenia krok po kroku']) {
  if (!docs.includes(heading)) throw new Error(`Dokumentacja kopii nie zawiera: ${heading}`);
}

console.log('Procedura backupu obejmuje bazę, Storage, konfigurację i test odtworzenia.');
