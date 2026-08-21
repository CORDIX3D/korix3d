import { createHash, createPublicKey, verify } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSlicerWorkerEnvironment } from '@/lib/env/server';

const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export function createWorkerCanonicalRequest(
  timestamp: string,
  workerId: string,
  method: string,
  pathname: string,
  body: string
) {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  return `${timestamp}\n${workerId}\n${method.toUpperCase()}\n${pathname}\n${bodyHash}`;
}

export async function requireSignedSlicerWorker(
  request: NextRequest,
  responseHeaders: Record<string, string>
) {
  let workerPublicKey: ReturnType<typeof createPublicKey>;
  try {
    workerPublicKey = createPublicKey(
      getRequiredSlicerWorkerEnvironment().CREALITY_SLICER_WORKER_PUBLIC_KEY
    );
  } catch {
    return NextResponse.json(
      { error: 'Usługa zdalnego slicera jest chwilowo niedostępna.' },
      { status: 503, headers: { ...responseHeaders, 'Retry-After': '60' } }
    );
  }

  const timestamp = request.headers.get('x-korix3d-timestamp') || '';
  const workerId = request.headers.get('x-korix3d-worker-id') || '';
  const encodedSignature = request.headers.get('x-korix3d-signature') || '';
  const timestampMs = Number(timestamp);

  if (
    !/^\d{13}$/.test(timestamp)
    || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS
    || !/^[a-zA-Z0-9._-]{3,120}$/.test(workerId)
    || !/^[a-zA-Z0-9_-]{80,100}$/.test(encodedSignature)
  ) {
    return NextResponse.json(
      { error: 'Nieprawidłowe uwierzytelnienie workera.' },
      { status: 401, headers: responseHeaders }
    );
  }

  const body = await request.clone().text();
  const canonical = createWorkerCanonicalRequest(
    timestamp,
    workerId,
    request.method,
    request.nextUrl.pathname,
    body
  );
  let signature: Buffer;
  try {
    signature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    signature = Buffer.alloc(0);
  }
  const valid = signature.length === 64 && verify(
    null,
    Buffer.from(canonical),
    workerPublicKey,
    signature
  );
  if (!valid) {
    return NextResponse.json(
      { error: 'Nieprawidłowe uwierzytelnienie workera.' },
      { status: 401, headers: responseHeaders }
    );
  }
  return null;
}
