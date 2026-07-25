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

type StoredSlicerFile = {
  name?: string;
  size?: number;
  type?: string;
  bucket?: string;
  storage_path?: string;
};

function boundedString(value: unknown, maxLength: number) {
  const text = String(value || '').trim();
  return text.length <= maxLength ? text : '';
}

export async function POST(request: NextRequest) {
  const authError = requireSlicerWorker(request);
  if (authError) return authError;

  try {
    const body = await readJsonObject(request, 16 * 1024);
    const workerId = boundedString(body.worker_id, 120);
    const printerProfile = boundedString(body.printer_profile, 240) || null;
    const processProfile = boundedString(body.process_profile, 240) || null;

    if (!workerId) {
      return NextResponse.json(
        { error: 'Brak poprawnego identyfikatora workera.' },
        { status: 400, headers: SLICER_RESPONSE_HEADERS }
      );
    }

    const admin = getSlicerServiceClient();
    const { data, error } = await admin.rpc('claim_slicing_job', {
      p_worker_id: workerId,
      p_printer_profile: printerProfile,
      p_process_profile: processProfile,
    });

    if (error) throw error;

    const job = Array.isArray(data) ? data[0] : null;
    if (!job) {
      return NextResponse.json(
        { job: null },
        { status: 200, headers: SLICER_RESPONSE_HEADERS }
      );
    }

    const inputFile = (job.input_file || {}) as StoredSlicerFile;
    const bucket = String(inputFile.bucket || '');
    const storagePath = String(inputFile.storage_path || '');

    if (bucket !== 'quote-files' || !storagePath) {
      await admin.rpc('finish_slicing_job', {
        p_job_id: job.id,
        p_status: 'failed',
        p_result: null,
        p_error_message: 'Niepoprawna lokalizacja pliku wejĹ›ciowego.',
        p_slicer_name: 'Creality Print',
        p_slicer_version: null,
      });
      return NextResponse.json(
        { error: 'Zadanie zawiera niepoprawny plik wejĹ›ciowy.' },
        { status: 409, headers: SLICER_RESPONSE_HEADERS }
      );
    }

    const { data: signedFile, error: signedFileError } = await admin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 15 * 60);

    if (signedFileError || !signedFile?.signedUrl) {
      throw signedFileError || new Error('Signed URL was not created');
    }

    return NextResponse.json(
      {
        job: {
          id: job.id,
          order_id: job.order_id,
          file_index: job.file_index,
          file_name: inputFile.name || `model-${job.file_index + 1}`,
          file_type: inputFile.type || null,
          file_size: Number(inputFile.size || 0),
          download_url: signedFile.signedUrl,
          material: job.material_name,
          color: job.color,
          infill_percent: job.infill_percent,
          printer_profile: job.printer_profile,
          process_profile: job.process_profile,
        },
      },
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
      console.error('Slicer job claim error:', error);
    }
    return slicerUnavailableResponse();
  }
}
