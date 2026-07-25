import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const skippedDirectories = new Set([
  '.git',
  '.next',
  '.netlify',
  'build',
  'coverage',
  'node_modules',
  'out',
]);
const scannedExtensions = new Set([
  '',
  '.env',
  '.example',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const ignoredFiles = new Set(['scripts/check-secrets.mjs']);
const secretPatterns = [
  /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bsbp_[A-Za-z0-9]{16,}\b/g,
  /\bwhsec_[A-Za-z0-9]{16,}\b/g,
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else if (entry.isFile()) {
      const projectPath = relative(root, absolutePath).replaceAll('\\', '/');
      if (!ignoredFiles.has(projectPath) && scannedExtensions.has(extname(entry.name))) {
        files.push({ absolutePath, projectPath });
      }
    }
  }

  return files;
}

const findings = [];
for (const file of await collectFiles(root)) {
  const content = await readFile(file.absolutePath, 'utf8');
  if (secretPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  })) {
    findings.push(file.projectPath);
  }
}

if (findings.length > 0) {
  console.error(`Wykryto możliwe sekrety w plikach:\n${findings.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Nie wykryto kluczy usług zewnętrznych w plikach projektu.');
}
