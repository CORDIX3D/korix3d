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

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await request.json();
    const settings = normalizeSettings(body.settings);

    if (!settings || settings.some((setting) => !setting.key)) {
      return NextResponse.json({ error: 'Niepoprawne dane ustawień AI.' }, { status: 400 });
    }

    for (const setting of settings) {
      const { error } = await context.client
        .from('ai_settings')
        .update({ setting_value: setting.value, updated_at: new Date().toISOString() })
        .eq('setting_key', setting.key);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin AI settings update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zapisać ustawień AI.' },
      { status: 500 }
    );
  }
}
