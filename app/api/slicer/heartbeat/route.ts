import { NextRequest, NextResponse } from 'next/server';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';
import {
  getSlicerServiceClient,
  requireSlicerWorker,
  SLICER_RESPONSE_HEADERS,
  slicerUnavailableResponse,
} from '@/lib/slicer/server';

export const dynamic = 'force-dynamic';

function boundedString(value: unknown, maxLength: number) {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : '';
}

export async function POST(request: NextRequest) {
  const authError = await requireSlicerWorker(request);
  if (authError) return authError;

  try {
    const body = await readJsonObject(request, 16 * 1024);
    const workerId = boundedString(body.worker_id, 120);

    if (!workerId) {
      return NextResponse.json(
        { error: 'Brak poprawnego identyfikatora workera.' },
        { status: 400, headers: SLICER_RESPONSE_HEADERS }
      );
    }

    const { error } = await getSlicerServiceClient().from('slicer_workers').upsert(
      {
        id: workerId,
        slicer_name: 'Creality Print',
        slicer_version: boundedString(body.slicer_version, 120) || null,
        printer_profile: boundedString(body.printer_profile, 240) || null,
        process_profile: boundedString(body.process_profile, 240) || null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) throw error;
    return NextResponse.json(
      { success: true },
      { headers: SLICER_RESPONSE_HEADERS }
    );
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: SLICER_RESPONSE_HEADERS }
      );
    }
    if (!isSupabaseConfigurationError(error)) {
      console.error('Slicer heartbeat error:', error);
    }
    return slicerUnavailableResponse();
  }
}
