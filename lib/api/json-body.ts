import { NextRequest } from 'next/server';

const DEFAULT_MAX_BYTES = 64 * 1024;

export class JsonBodyError extends Error {
  readonly status: 400 | 413 | 415;

  constructor(message: string, status: 400 | 413 | 415) {
    super(message);
    this.name = 'JsonBodyError';
    this.status = status;
  }
}

export async function readJsonObject(
  request: NextRequest,
  maxBytes = DEFAULT_MAX_BYTES
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    throw new JsonBodyError('Żądanie musi zawierać dane JSON.', 415);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new JsonBodyError('Przesłane dane są zbyt duże.', 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    throw new JsonBodyError('Przesłane dane są zbyt duże.', 413);
  }

  if (!rawBody.trim()) {
    throw new JsonBodyError('Brak danych formularza.', 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new JsonBodyError('Niepoprawny format danych JSON.', 400);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new JsonBodyError('Niepoprawny format danych formularza.', 400);
  }

  return parsed as Record<string, unknown>;
}

export function isJsonBodyError(error: unknown): error is JsonBodyError {
  return error instanceof JsonBodyError;
}
