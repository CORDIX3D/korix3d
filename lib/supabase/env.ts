export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}

export function getRequiredSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    throw new Error('Brak konfiguracji Supabase w zmiennych środowiskowych');
  }
  return env;
}

export function getRequiredSupabaseServiceEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceRoleKey) {
    throw new Error('Brak konfiguracji Supabase Service Role w zmiennych środowiskowych');
  }

  return { url, serviceRoleKey };
}
