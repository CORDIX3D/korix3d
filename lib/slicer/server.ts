import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { requireSignedSlicerWorker } from '@/lib/slicer/worker-signature';

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

export function requireSlicerWorker(request: NextRequest) {
  return requireSignedSlicerWorker(request, SLICER_RESPONSE_HEADERS);
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
