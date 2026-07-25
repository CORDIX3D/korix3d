import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';

export const SLICER_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

export function getSlicerServiceClient() {
  const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function requireSlicerWorker(request: NextRequest) {
  const configuredToken = process.env.CREALITY_SLICER_WORKER_TOKEN?.trim() || '';
  const authorization = request.headers.get('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!configuredToken) {
    return NextResponse.json(
      { error: 'Zdalny slicer nie jest jeszcze skonfigurowany.' },
      { status: 503, headers: SLICER_RESPONSE_HEADERS }
    );
  }

  if (
    !suppliedToken ||
    !timingSafeEqual(digest(configuredToken), digest(suppliedToken))
  ) {
    return NextResponse.json(
      { error: 'Nieprawidłowe uwierzytelnienie workera.' },
      { status: 401, headers: SLICER_RESPONSE_HEADERS }
    );
  }

  return null;
}

export function slicerUnavailableResponse() {
  return NextResponse.json(
    { error: 'Usługa zdalnego slicera jest chwilowo niedostępna.' },
    {
      status: 503,
      headers: {
        ...SLICER_RESPONSE_HEADERS,
        'Retry-After': '60',
      },
    }
  );
}
