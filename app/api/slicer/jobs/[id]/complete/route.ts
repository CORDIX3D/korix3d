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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function finiteNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function optionalString(value: unknown, maxLength: number) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireSlicerWorker(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: 'Niepoprawny identyfikator zadania.' },
        { status: 400, headers: SLICER_RESPONSE_HEADERS }
      );
    }

    const body = await readJsonObject(request, 64 * 1024);
    const status = String(body.status || '').trim();
    const slicerName = optionalString(body.slicer_name, 120) || 'Creality Print';
    const slicerVersion = optionalString(body.slicer_version, 120);
    let result: Record<string, unknown> | null = null;
    let errorMessage: string | null = null;

    if (status === 'completed') {
      const printingTimeSeconds = finiteNumber(
        body.printing_time_seconds,
        1,
        365 * 24 * 60 * 60
      );
      const filamentUsedGrams = finiteNumber(body.filament_used_grams, 0.01, 1_000_000);
      const layerCount = finiteNumber(body.layer_count, 1, 10_000_000);

      if (printingTimeSeconds === null || filamentUsedGrams === null) {
        return NextResponse.json(
          { error: 'Wynik slicera nie zawiera poprawnego czasu i zużycia filamentu.' },
          { status: 400, headers: SLICER_RESPONSE_HEADERS }
        );
      }

      result = {
        printing_time_seconds: printingTimeSeconds,
        filament_used_grams: filamentUsedGrams,
        layer_count: layerCount,
        gcode_file_name: optionalString(body.gcode_file_name, 255),
        warnings: Array.isArray(body.warnings)
          ? body.warnings
              .slice(0, 20)
              .map((warning) => String(warning).slice(0, 500))
          : [],
      };
    } else if (status === 'failed') {
      errorMessage =
        optionalString(body.error_message, 1000) ||
        'Creality Print nie ukończył analizy pliku.';
    } else {
      return NextResponse.json(
        { error: 'Niepoprawny status wyniku.' },
        { status: 400, headers: SLICER_RESPONSE_HEADERS }
      );
    }

    const admin = getSlicerServiceClient();
    const { data, error } = await admin.rpc('finish_slicing_job', {
      p_job_id: id,
      p_status: status,
      p_result: result,
      p_error_message: errorMessage,
      p_slicer_name: slicerName,
      p_slicer_version: slicerVersion,
    });

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Zadanie nie istnieje albo zostało już zakończone.' },
        { status: 409, headers: SLICER_RESPONSE_HEADERS }
      );
    }

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
      console.error('Slicer job completion error:', error);
    }
    return slicerUnavailableResponse();
  }
}
