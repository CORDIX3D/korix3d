import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiContext, adminApiUnavailableResponse } from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { 'Cache-Control': 'no-store' } as const;
const MISSING_HEARTBEAT_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const WORKER_ONLINE_WINDOW_MS = 90_000;

export async function GET() {
  const result = await requireAdminApiContext();
  if (result.response) return result.response;

  try {
    const [jobsResult, workersResult] = await Promise.all([
      result.context.adminClient
        .from('slicing_jobs')
        .select(
          'id, order_id, file_index, input_file, material_name, color, infill_percent, status, attempt_count, worker_id, printer_profile, process_profile, slicer_name, slicer_version, result, error_message, requested_at, started_at, completed_at, orders_3d(order_number)'
        )
        .order('requested_at', { ascending: false })
        .limit(100),
      result.context.adminClient
        .from('slicer_workers')
        .select('id, slicer_name, slicer_version, printer_profile, process_profile, last_seen_at')
        .order('last_seen_at', { ascending: false })
        .limit(20),
    ]);

    if (jobsResult.error) throw jobsResult.error;

    const heartbeatAvailable = !workersResult.error;
    if (
      workersResult.error
      && !MISSING_HEARTBEAT_TABLE_CODES.has(String(workersResult.error.code || ''))
    ) {
      throw workersResult.error;
    }

    const jobs = jobsResult.data || [];
    const workers = heartbeatAvailable ? workersResult.data || [] : [];
    const now = Date.now();
    const activeWorkers = workers.filter((worker) => {
      const lastSeen = new Date(worker.last_seen_at).getTime();
      return Number.isFinite(lastSeen) && now - lastSeen <= WORKER_ONLINE_WINDOW_MS;
    });
    const counts = jobs.reduce<Record<string, number>>((accumulator, job) => {
      accumulator[job.status] = (accumulator[job.status] || 0) + 1;
      return accumulator;
    }, {});

    return NextResponse.json(
      {
        configured: Boolean(process.env.CREALITY_SLICER_WORKER_TOKEN?.trim()),
        heartbeat_available: heartbeatAvailable,
        worker_online: activeWorkers.length > 0,
        workers,
        counts,
        jobs,
        checked_at: new Date(now).toISOString(),
      },
      { headers: HEADERS }
    );
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Admin slicer list error:', error);
    }
    return adminApiUnavailableResponse();
  }
}

export async function PATCH(request: NextRequest) {
  const result = await requireAdminApiContext();
  if (result.response) return result.response;

  try {
    const body = await readJsonObject(request, 16 * 1024);
    const jobId = String(body.job_id || '').trim();

    if (body.action !== 'retry' || !UUID_PATTERN.test(jobId)) {
      return NextResponse.json(
        { error: 'Niepoprawne dane ponowienia zadania.' },
        { status: 400, headers: HEADERS }
      );
    }

    const { data: job, error: jobError } = await result.context.adminClient
      .from('slicing_jobs')
      .update({
        status: 'pending',
        attempt_count: 0,
        worker_id: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .in('status', ['failed', 'cancelled'])
      .select('id, order_id')
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      return NextResponse.json(
        { error: 'Zadanie nie istnieje albo nie można go teraz ponowić.' },
        { status: 409, headers: HEADERS }
      );
    }

    const { error: orderError } = await result.context.adminClient
      .from('orders_3d')
      .update({
        slicing_status: 'pending',
        sliced_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.order_id);

    if (orderError) throw orderError;

    return NextResponse.json({ success: true }, { headers: HEADERS });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: HEADERS }
      );
    }

    if (!isSupabaseConfigurationError(error)) {
      console.error('Admin slicer retry error:', error);
    }
    return adminApiUnavailableResponse();
  }
}
