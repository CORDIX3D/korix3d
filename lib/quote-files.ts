export const ALLOWED_QUOTE_FILE_TYPES = new Set(['stl', 'step', 'stp', 'obj', '3mf']);
const MAX_QUOTE_FILE_BYTES = 50 * 1024 * 1024;
const MAX_QUOTE_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_QUOTE_FILES = 10;

export type StoredQuoteFile = {
  name?: string;
  size?: number;
  type?: string;
  bucket?: string;
  storage_path?: string;
};

function cleanString(value: unknown) {
  return String(value || '').trim();
}

export function isSafeQuoteFileName(name: unknown, type: unknown) {
  const cleanName = cleanString(name);
  const cleanType = cleanString(type).toLowerCase();
  return cleanName.length > 0
    && cleanName.length <= 255
    && !cleanName.includes('..')
    && !/[\\/\u0000-\u001f\u007f]/.test(cleanName)
    && ALLOWED_QUOTE_FILE_TYPES.has(cleanType)
    && cleanName.toLowerCase().endsWith(`.${cleanType}`);
}

export function validateQuoteFiles(files: unknown, userId: string, orderId: string) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_QUOTE_FILES) {
    return 'Niepoprawna liczba plików.';
  }

  const prefix = `${userId}/${orderId}/`;
  let totalSize = 0;
  const uniquePaths = new Set<string>();

  for (const file of files as StoredQuoteFile[]) {
    const size = Number(file.size);
    const type = cleanString(file.type).toLowerCase();
    const path = cleanString(file.storage_path);
    const name = cleanString(file.name);
    const storedFileName = path.slice(prefix.length);

    if (
      cleanString(file.bucket) !== 'quote-files' ||
      !path.startsWith(prefix) ||
      !storedFileName ||
      storedFileName.includes('/') ||
      storedFileName.includes('\\') ||
      storedFileName.includes('..') ||
      path.length > 1024 ||
      !isSafeQuoteFileName(name, type) ||
      !ALLOWED_QUOTE_FILE_TYPES.has(type) ||
      !storedFileName.toLowerCase().endsWith(`.${type}`) ||
      !Number.isFinite(size) ||
      size < 1 ||
      size > MAX_QUOTE_FILE_BYTES ||
      uniquePaths.has(path)
    ) {
      return 'Niepoprawne metadane pliku.';
    }

    uniquePaths.add(path);
    totalSize += size;
  }

  if (totalSize > MAX_QUOTE_TOTAL_BYTES) {
    return 'Przekroczono łączny limit plików.';
  }

  return null;
}
