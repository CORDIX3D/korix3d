import { createServiceRoleClient } from '@/lib/supabase/service-client';
import type { StoredQuoteFile } from '@/lib/quote-files';
import { validateQuoteFileSignature } from '@/lib/quote-file-content';

async function readFileRange(url: string, range: string, requirePartial = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { Range: range },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok || (requirePartial && response.status !== 206) || !response.body) {
      throw new Error('Stored file range is unavailable');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 131_072) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = 131_072 - total;
      const chunk = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.length;
      if (value.length > remaining) break;
    }
    await reader.cancel();

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyStoredQuoteFiles(
  admin: ReturnType<typeof createServiceRoleClient>,
  files: StoredQuoteFile[]
) {
  for (const file of files) {
    const bucket = String(file.bucket || '');
    const storagePath = String(file.storage_path || '');
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) throw error || new Error('Signed file URL missing');

    const head = await readFileRange(data.signedUrl, 'bytes=0-131071');
    const tail = file.type === '3mf'
      ? await readFileRange(data.signedUrl, 'bytes=-131072', true)
      : head;
    const validationError = validateQuoteFileSignature(file, head, tail);
    if (validationError) return validationError;
  }
  return null;
}
