import { NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireStaffApiContext,
} from '@/lib/api/admin-context';
import { getProductionOverview } from '@/lib/production/overview';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await requireStaffApiContext();
  if (result.response) return result.response;

  try {
    return NextResponse.json(
      await getProductionOverview(result.context.adminClient),
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Production overview error:', error);
    }
    return adminApiUnavailableResponse();
  }
}
