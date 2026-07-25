import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { isStaffRole } from '@/lib/admin-access';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';
import {
  canTransitionOrder3DStatus,
  getAllowedOrder3DStatuses,
  isOrder3DStatus,
  ORDER_3D_STATUS_LABELS,
} from '@/lib/order-3d-status';

export const dynamic = 'force-dynamic';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailableResponse() {
  return NextResponse.json(
    { error: 'Obsługa zamówień jest chwilowo niedostępna.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    }
  );
}

async function getAdminSupabaseClient() {
  const sessionClient = await createClient();
  const { data: auth } = await sessionClient.auth.getUser();

  if (!auth.user) {
    return { error: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Order staff profile lookup error:', profileError);
    return { error: unavailableResponse() };
  }

  if (!isStaffRole(profile?.role)) {
    return { error: NextResponse.json({ error: 'Brak uprawnień pracownika.' }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return { client: createServiceRoleClient(url, serviceKey, auth.user.id) };
  }

  return { client: sessionClient };
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function isOrderTransitionDatabaseError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code || '') : '';
  const message = 'message' in error ? String(error.message || '') : '';
  return code === '23514' && (
    message.includes('order 3d status transition')
    || message.includes('quote pricing is incomplete')
    || message.includes('must start with status new')
    || message.includes('quote terms are immutable')
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await readJsonObject(request, 32 * 1024);
    const id = String(body.id || '').trim();
    const action = String(body.action || '').trim();

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator zamówienia.' }, { status: 400 });
    }

    if (action === 'status') {
      const status = String(body.status || '').trim();
      if (!isOrder3DStatus(status)) {
        return NextResponse.json({ error: 'Niepoprawny status zamówienia.' }, { status: 400 });
      }

      const { data: currentOrder, error: currentOrderError } = await context.client
        .from('orders_3d')
        .select('status')
        .eq('id', id)
        .maybeSingle();

      if (currentOrderError) throw currentOrderError;
      if (!currentOrder) {
        return NextResponse.json({ error: 'Nie znaleziono zamówienia.' }, { status: 404 });
      }

      if (!canTransitionOrder3DStatus(currentOrder.status, status)) {
        const allowedLabels = getAllowedOrder3DStatuses(currentOrder.status)
          .filter((value) => value !== currentOrder.status)
          .map((value) => ORDER_3D_STATUS_LABELS[value]);
        return NextResponse.json(
          {
            error: allowedLabels.length > 0
              ? `Z obecnego etapu można przejść tylko do: ${allowedLabels.join(', ')}.`
              : 'To zamówienie ma już status końcowy.',
          },
          { status: 409 }
        );
      }

      const { data, error } = await context.client
        .from('orders_3d')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', currentOrder.status)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: 'Status zamówienia zmienił się w międzyczasie. Odśwież listę.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'quote') {
      const printingTime = positiveNumber(body.printing_time_hours);
      const filamentWeight = positiveNumber(body.filament_used_grams);
      const finalPrice = positiveNumber(body.final_price);

      if (!printingTime || !filamentWeight || !finalPrice) {
        return NextResponse.json(
          { error: 'Czas druku, ilość filamentu i cena muszą być większe od zera.' },
          { status: 400 }
        );
      }

      const { data, error } = await context.client
        .from('orders_3d')
        .update({
          status: 'quoted',
          printing_time_hours: printingTime,
          filament_used_grams: filamentWeight,
          final_price: finalPrice,
          admin_notes: String(body.admin_notes || '').trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .in('status', ['new', 'quoted'])
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: 'Można wyceniać tylko nowe zlecenia lub poprawiać istniejącą wycenę.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Niepoprawna akcja zamówienia.' }, { status: 400 });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return unavailableResponse();
    }

    if (isOrderTransitionDatabaseError(error)) {
      return NextResponse.json(
        {
          error: error && typeof error === 'object' && 'message' in error
            && String(error.message || '').includes('quote terms are immutable')
            ? 'Nie można zmienić warunków zaakceptowanej wyceny.'
            : 'Nie można pominąć wymaganego etapu realizacji zamówienia.',
        },
        { status: 409 }
      );
    }

    console.error('Admin order update error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zaktualizować zamówienia.' },
      { status: 500 }
    );
  }
}
