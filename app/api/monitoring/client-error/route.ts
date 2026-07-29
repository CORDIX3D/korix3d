import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { captureServerError } from '@/lib/monitoring/server';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  source: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1000),
  digest: z.string().trim().max(120).optional().default(''),
  stack: z.string().max(4000).optional().default(''),
  path: z.string().trim().startsWith('/').max(500),
}).strict();

const windows = new Map<string, { count: number; startedAt: number }>();

function requestAddress(request: NextRequest) {
  return request.headers.get('x-nf-client-connection-ip')?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function consumeLimit(request: NextRequest) {
  const key = requestAddress(request).slice(0, 100);
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    windows.set(key, { count: 1, startedAt: now });
    return true;
  }
  current.count += 1;
  if (windows.size > 2000) {
    for (const [entryKey, value] of windows) {
      if (now - value.startedAt >= 60_000) windows.delete(entryKey);
    }
  }
  return current.count <= 10;
}

export async function POST(request: NextRequest) {
  if (!consumeLimit(request)) {
    return NextResponse.json(
      { error: 'Osiągnięto limit raportów błędów.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
    );
  }

  try {
    const parsed = requestSchema.safeParse(await readJsonObject(request, 16 * 1024));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Niepoprawny raport błędu.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const eventId = captureServerError(
      Object.assign(new Error(parsed.data.message), { stack: parsed.data.stack }),
      {
        source: `client:${parsed.data.source}`,
        digest: parsed.data.digest,
        path: parsed.data.path,
      }
    );

    return NextResponse.json(
      { accepted: true, eventId },
      { status: 202, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: 'Nie udało się przyjąć raportu błędu.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
