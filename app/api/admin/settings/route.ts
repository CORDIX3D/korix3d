import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

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

  if (profileError || profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return { client: createServiceRoleClient(url, serviceKey, auth.user.id) };
  }

  return { client: sessionClient };
}

function normalizeSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  return Object.entries(settings as Record<string, unknown>).map(([key, value]) => ({
    key: key.trim(),
    value: String(value ?? ''),
  }));
}

const NON_NEGATIVE_NUMBER_SETTINGS = new Set([
  'printing_hour_cost',
  'electricity_hour_cost',
  'maintenance_hour_cost',
  'packaging_cost',
  'default_margin',
  'vat_rate',
  'minimum_order_value',
  'express_surcharge',
  'urgent_surcharge',
  'free_shipping_threshold',
]);

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await request.json();
    const settings = normalizeSettings(body.settings);

    if (
      !settings ||
      settings.length > 100 ||
      settings.some(
        (setting) =>
          !/^[a-z0-9_]{1,100}$/.test(setting.key) ||
          setting.value.length > 2000
      )
    ) {
      return NextResponse.json({ error: 'Niepoprawne dane ustawień.' }, { status: 400 });
    }

    for (const setting of settings) {
      if (!NON_NEGATIVE_NUMBER_SETTINGS.has(setting.key)) continue;
      const value = Number(setting.value.replace(',', '.'));
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json(
          { error: `Ustawienie ${setting.key} musi być liczbą równą lub większą od 0.` },
          { status: 400 }
        );
      }
    }

    for (const setting of settings) {
      const { error } = await context.client
        .from('settings')
        .update({ value: setting.value, updated_at: new Date().toISOString() })
        .eq('key', setting.key);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin settings update error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zapisać ustawień. Sprawdź połączenie i spróbuj ponownie.' },
      { status: 500 }
    );
  }
}
