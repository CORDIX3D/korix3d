import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { 'Cache-Control': 'no-store' } as const;

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

    const { data: order, error } = await supabase
      .from('orders_3d')
      .select(
        'id, order_number, status, slicing_status, printing_time_hours, filament_used_grams, material_cost, electricity_cost, printing_cost, packaging_cost, margin_amount, vat_amount, delivery_cost, final_price, sliced_at'
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

    return NextResponse.json(
      {
        state: ready ? 'ready' : manualReview ? 'manual_review' : 'calculating',
        order_number: order.order_number,
        slicing_status: order.slicing_status,
        printing_time_hours: order.printing_time_hours,
        filament_used_grams: order.filament_used_grams,
        costs: ready
          ? {
              material: order.material_cost,
              printing: order.printing_cost,
              electricity: order.electricity_cost,
              packaging: order.packaging_cost,
              delivery: order.delivery_cost,
              margin: order.margin_amount,
              vat: order.vat_amount,
            }
          : null,
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
