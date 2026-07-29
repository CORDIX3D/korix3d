import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getRequiredMonitoringEnvironment } from '@/lib/env/server';
import { inspectServerEnvironment } from '@/lib/env/server';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { captureServerError } from '@/lib/monitoring/server';

export const dynamic = 'force-dynamic';

const RESPONSE_HEADERS = { 'Cache-Control': 'no-store' } as const;
const REQUIRED_BUCKETS = ['accounting-reports', 'product-images', 'quote-files'];

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function isAuthorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  return Boolean(supplied) && timingSafeEqual(digest(secret), digest(supplied));
}

export async function GET(request: NextRequest) {
  let monitoringSecret: string;
  try {
    monitoringSecret = getRequiredMonitoringEnvironment().CRON_SECRET;
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: RESPONSE_HEADERS }
    );
  }

  if (!isAuthorized(request, monitoringSecret)) {
    return NextResponse.json(
      { error: 'Brak dostępu.' },
      { status: 401, headers: RESPONSE_HEADERS }
    );
  }

  const checkedAt = new Date();
  const oneDayAgo = new Date(checkedAt.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const queueDeadline = new Date(checkedAt.getTime() - 30 * 60 * 1000).toISOString();
  const workerDeadline = checkedAt.getTime() - 5 * 60 * 1000;

  try {
    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createSupabaseClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [database, buckets, webhookFailures, stalledJobs, workers] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.storage.listBuckets(),
      admin
        .from('stripe_webhook_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('updated_at', oneDayAgo),
      admin
        .from('slicing_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'processing'])
        .lt('requested_at', queueDeadline),
      admin
        .from('slicer_workers')
        .select('last_seen_at')
        .order('last_seen_at', { ascending: false })
        .limit(1),
    ]);

    const bucketIds = new Set((buckets.data || []).map((bucket) => bucket.id));
    const environment = inspectServerEnvironment();
    const latestWorker = workers.data?.[0]?.last_seen_at
      ? new Date(workers.data[0].last_seen_at).getTime()
      : 0;
    const checks = {
      api: true,
      supabase: !database.error,
      upload: !buckets.error && REQUIRED_BUCKETS.every((bucket) => bucketIds.has(bucket)),
      stripe: environment.stripe.configured
        && !webhookFailures.error
        && (webhookFailures.count || 0) === 0,
      worker: environment.slicer.configured
        && !workers.error
        && latestWorker >= workerDeadline,
      backgroundJobs: !stalledJobs.error && (stalledJobs.count || 0) === 0,
    };
    const healthy = Object.values(checks).every(Boolean);
    const record = {
      type: 'korix3d_production_health',
      level: healthy ? 'info' : 'error',
      checkedAt: checkedAt.toISOString(),
      checks,
      counts: {
        failedStripeEvents24h: webhookFailures.count ?? null,
        stalledSlicerJobs: stalledJobs.count ?? null,
      },
      deployment: process.env.VERCEL_GIT_COMMIT_SHA || null,
    };

    if (healthy) console.info(JSON.stringify(record));
    else console.error(JSON.stringify(record));

    return NextResponse.json(
      { status: healthy ? 'ok' : 'degraded', checkedAt: record.checkedAt, checks },
      { status: healthy ? 200 : 503, headers: RESPONSE_HEADERS }
    );
  } catch (error) {
    const eventId = captureServerError(error, {
      source: 'production-health',
      path: '/api/monitoring/production-health',
    });
    return NextResponse.json(
      { status: 'unavailable', eventId, checkedAt: checkedAt.toISOString() },
      { status: 503, headers: RESPONSE_HEADERS }
    );
  }
}
