import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { PUBLIC_FILAMENT_COLUMNS } from '@/lib/public-filament';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: NextRequest) {
  try {
    const materialId = request.nextUrl.searchParams.get('material_id')?.trim() || '';
    if (materialId && !UUID_PATTERN.test(materialId)) {
      return NextResponse.json(
        { error: 'Niepoprawny identyfikator materiału.' },
        { status: 400, headers: HEADERS }
      );
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createServiceRoleClient(url, serviceRoleKey);
    let query = admin
      .from('filaments')
      .select(PUBLIC_FILAMENT_COLUMNS)
      .eq('active', true)
      .gt('remaining_weight_grams', 0)
      .order('material_name')
      .order('color')
      .limit(500);

    if (materialId) query = query.eq('material_id', materialId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ filaments: data || [] }, { headers: HEADERS });
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Public filaments error:', error);
    }
    return NextResponse.json(
      { error: 'Nie udało się pobrać dostępnych filamentów.' },
      { status: 503, headers: { ...HEADERS, 'Retry-After': '5' } }
    );
  }
}

