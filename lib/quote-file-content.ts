import type { StoredQuoteFile } from '@/lib/quote-files';

const decoder = new TextDecoder('utf-8', { fatal: false });

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function textSample(bytes: Uint8Array) {
  return decoder.decode(bytes).replace(/\0/g, '');
}

function hasDangerousSignature(bytes: Uint8Array) {
  const text = textSample(bytes.slice(0, 512)).trimStart().toLowerCase();
  return startsWith(bytes, [0x4d, 0x5a])
    || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])
    || startsWith(bytes, [0x23, 0x21])
    || text.startsWith('<!doctype html')
    || text.startsWith('<html')
    || text.startsWith('<script')
    || text.startsWith('<?php');
}

export function validateQuoteFileSignature(
  file: StoredQuoteFile,
  head: Uint8Array,
  tail: Uint8Array = head
) {
  const type = String(file.type || '').toLowerCase();
  const size = Number(file.size || 0);
  if (head.length === 0 || hasDangerousSignature(head)) {
    return 'Plik ma niebezpieczną albo pustą zawartość.';
  }

  const headText = textSample(head);
  if (type === 'step' || type === 'stp') {
    return /ISO-10303-21\s*;/i.test(headText) && /HEADER\s*;/i.test(headText)
      ? null
      : 'Zawartość pliku nie odpowiada formatowi STEP.';
  }

  if (type === 'obj') {
    return /^(?:v|vn|vt|f|o|g|s|mtllib|usemtl)\s+/im.test(headText)
      ? null
      : 'Zawartość pliku nie odpowiada formatowi OBJ.';
  }

  if (type === 'stl') {
    if (/^\s*solid(?:\s|$)/i.test(headText) && /(?:facet|endsolid)(?:\s|$)/i.test(headText)) {
      return null;
    }
    if (head.length < 84 || !Number.isSafeInteger(size)) {
      return 'Zawartość pliku nie odpowiada formatowi STL.';
    }
    const triangleCount = new DataView(
      head.buffer,
      head.byteOffset,
      head.byteLength
    ).getUint32(80, true);
    return 84 + triangleCount * 50 === size
      ? null
      : 'Zawartość pliku nie odpowiada formatowi STL.';
  }

  if (type === '3mf') {
    const archiveText = `${headText}\n${textSample(tail)}`.toLowerCase();
    return startsWith(head, [0x50, 0x4b, 0x03, 0x04])
      && archiveText.includes('[content_types].xml')
      && archiveText.includes('3d/3dmodel.model')
      ? null
      : 'Zawartość pliku nie odpowiada formatowi 3MF.';
  }

  return 'Nieobsługiwany format pliku.';
}
