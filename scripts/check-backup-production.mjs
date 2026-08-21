import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const root = process.cwd();
const runner = await readFile(join(root, 'scripts/backup/backup-production.ps1'), 'utf8');
const storage = await readFile(join(root, 'scripts/backup/backup-storage.mjs'), 'utf8');
const verifier = await readFile(join(root, 'scripts/backup/verify-backup.mjs'), 'utf8');
const encryptedVerifier = await readFile(join(root, 'scripts/backup/verify-encrypted-backup.ps1'), 'utf8');
const stagingAccount = await readFile(join(root, 'scripts/backup/prepare-staging-test-account.mjs'), 'utf8');
const stagingRestore = await readFile(join(root, 'scripts/backup/prepare-staging-restore.mjs'), 'utf8');
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
for (const requirement of [
  'instance_id',
  '00000000-0000-0000-0000-000000000000',
  'confirmation_token',
  'recovery_token',
  'email_change_token_new',
]) {
  if (!stagingAccount.includes(requirement)) {
    throw new Error(`Generator konta stagingowego nie spełnia kontraktu Supabase Auth: ${requirement}`);
  }
}
for (const requirement of [
  'allowedTables',
  'forbiddenTables',
  'public.settings',
  'public.ai_settings',
  'public.profiles',
  'public.orders_3d',
  'unexpectedPublicTables',
  'ON CONFLICT DO NOTHING',
]) {
  if (!stagingRestore.includes(requirement)) {
    throw new Error(`Przygotowanie restore stagingu nie spelnia kontraktu prywatnosci: ${requirement}`);
  }
}

const stagingRestorePath = join(root, 'scripts/backup/prepare-staging-restore.mjs');
const restoreContractRoot = await mkdtemp(join(tmpdir(), 'korix3d-restore-contract-'));
try {
  const sensitiveInput = join(restoreContractRoot, 'sensitive.sql');
  const sensitiveOutput = join(restoreContractRoot, 'sensitive-output');
  const fakeSensitiveValue = 'staging-contact@example.invalid';
  await writeFile(
    sensitiveInput,
    [
      'COPY public.settings (id, key, value, label, category, created_at, updated_at) FROM stdin;',
      `00000000-0000-0000-0000-000000000001\\tcontact_email\\t${fakeSensitiveValue}\\tKontakt\\tgeneral\\t2026-01-01 00:00:00+00\\t2026-01-01 00:00:00+00`,
      '\\.',
      '',
    ].join('\n'),
    'utf8',
  );
  await execFileAsync(process.execPath, [stagingRestorePath, sensitiveInput, sensitiveOutput]);
  const sensitiveManifest = await readFile(join(sensitiveOutput, 'manifest.json'), 'utf8');
  const generatedFiles = await readdir(sensitiveOutput);
  if (sensitiveManifest.includes(fakeSensitiveValue) || generatedFiles.some((file) => file.endsWith('.sql'))) {
    throw new Error('Przygotowanie restore stagingu zapisalo dane wrazliwe.');
  }

  const unknownInput = join(restoreContractRoot, 'unknown.sql');
  const unknownOutput = join(restoreContractRoot, 'unknown-output');
  await writeFile(
    unknownInput,
    ['COPY public.unreviewed_restore_data (id) FROM stdin;', '1', '\\.', ''].join('\n'),
    'utf8',
  );
  let unknownRejected = false;
  try {
    await execFileAsync(process.execPath, [stagingRestorePath, unknownInput, unknownOutput]);
  } catch {
    unknownRejected = true;
  }
  if (!unknownRejected) throw new Error('Nowa tabela publiczna nie zatrzymala restore stagingu.');
} finally {
  await rm(restoreContractRoot, { recursive: true, force: true });
}
for (const heading of ['## Backup konfiguracji i sekretów', '## Test odtworzenia krok po kroku']) {
  if (!docs.includes(heading)) throw new Error(`Dokumentacja kopii nie zawiera: ${heading}`);
}

console.log('Procedura backupu obejmuje bazę, Storage, konfigurację i test odtworzenia.');
