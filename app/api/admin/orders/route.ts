import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isStaffRole } from '@/lib/admin-access';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set([
  'new',
  'quoted',
  'accepted',
  'queued',
  'printing',
  'post_processing',
  'packed',
  'shipped',
  'completed',
  'cancelled',
]);
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
    return { client: createSupabaseClient(url, serviceKey) };
  }

  return { client: sessionClient };
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
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
      if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Niepoprawny status zamówienia.' }, { status: 400 });
      }

      const { data, error } = await context.client
        .from('orders_3d')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: 'Nie znaleziono zamówienia.' }, { status: 404 });
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
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: 'Nie znaleziono zamówienia.' }, { status: 404 });
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

    console.error('Admin order update error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zaktualizować zamówienia.' },
      { status: 500 }
    );
  }
}
