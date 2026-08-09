import { NextRequest, NextResponse } from 'next/server';
import { getProductionOverview } from '@/lib/production/overview';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';
import {
  getSlicerServiceClient,
  requireSlicerWorker,
  SLICER_RESPONSE_HEADERS,
  slicerUnavailableResponse,
} from '@/lib/slicer/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireSlicerWorker(request);
  if (authError) return authError;

  try {
    return NextResponse.json(
      await getProductionOverview(getSlicerServiceClient()),
      { headers: SLICER_RESPONSE_HEADERS }
    );
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Slicer dashboard error:', error);
    }
    return slicerUnavailableResponse();
  }
}
