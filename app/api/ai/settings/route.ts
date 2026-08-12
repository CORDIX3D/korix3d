import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/lib/supabase/env';

export const revalidate = 300;

const DEFAULT_GREETING = 'Cześć! Jestem bezpłatnym asystentem KORIX3D. Mogę sprawdzić materiały, kolory, stany magazynowe i pomóc w wycenie druku 3D.';
const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=86400';

function response(settings: { greeting: string; enabled: boolean }) {
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': CACHE_CONTROL },
  });
}

export async function GET() {
  const environment = getSupabaseEnv();
  if (!environment.isConfigured) {
    return response({ greeting: DEFAULT_GREETING, enabled: true });
  }

  try {
    const supabase = createClient(environment.url, environment.anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { data, error } = await supabase
      .from('ai_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['greeting', 'enabled']);

    if (error) throw error;
    const settings = data || [];
    return response({
      greeting: settings.find((setting) => setting.setting_key === 'greeting')?.setting_value || DEFAULT_GREETING,
      enabled: settings.find((setting) => setting.setting_key === 'enabled')?.setting_value !== 'false',
    });
  } catch (error) {
    console.error('Public AI settings lookup failed:', error);
    return response({ greeting: DEFAULT_GREETING, enabled: true });
  }
}
