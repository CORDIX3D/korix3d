import { NextResponse } from 'next/server';
import { getRuntimeHealth } from '@/lib/runtime-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = getRuntimeHealth();

  return NextResponse.json(
    {
      status: health.status,
      checkedAt: health.checkedAt,
    },
    {
      status: health.healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
