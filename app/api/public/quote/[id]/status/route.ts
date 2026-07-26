import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';
import { createServiceRoleClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { 'Cache-Control': 'no-store' } as const;

function readVatRate(slicingResult: unknown) {
  if (!slicingResult || typeof slicingResult !== 'object' || Array.isArray(slicingResult)) {
    return 23;
  }

  const pricing = (slicingResult as Record<string, unknown>).pricing;
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return 23;

  const rate = Number((pricing as Record<string, unknown>).vat_rate);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 23;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: 'Niepoprawny identyfikator wyceny.' },
        { status: 400, headers: HEADERS }
      );
    }

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError && (authError.status || 0) >= 500) {
      throw authError;
    }
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Zaloguj się ponownie.' },
        { status: 401, headers: HEADERS }
      );
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createServiceRoleClient(url, serviceRoleKey, auth.user.id);
    const { data: order, error } = await admin
      .from('orders_3d')
      .select(
        'id, order_number, status, slicing_status, printing_time_hours, filament_used_grams, final_price, slicing_result, sliced_at'
      )
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return NextResponse.json(
        { error: 'Nie znaleziono wyceny.' },
        { status: 404, headers: HEADERS }
      );
    }

    const ready = order.status === 'quoted' && Number(order.final_price || 0) > 0;
    const manualReview = ['failed', 'partial_failed'].includes(order.slicing_status)
      || (order.slicing_status === 'completed' && !ready);
    const vatRate = readVatRate(order.slicing_result);
    const netPrice = ready
      ? Math.round((Number(order.final_price) / (1 + vatRate / 100)) * 100) / 100
      : null;

    return NextResponse.json(
      {
        state: ready ? 'ready' : manualReview ? 'manual_review' : 'calculating',
        order_number: order.order_number,
        slicing_status: order.slicing_status,
        printing_time_hours: order.printing_time_hours,
        filament_used_grams: order.filament_used_grams,
        net_price: netPrice,
        final_price: ready ? order.final_price : null,
        sliced_at: order.sliced_at,
      },
      { headers: HEADERS }
    );
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Public quote status error:', error);
    }
    return NextResponse.json(
      { error: 'Nie udało się sprawdzić postępu wyceny.' },
      {
        status: 503,
        headers: {
          ...HEADERS,
          'Retry-After': '5',
        },
      }
    );
  }
}
