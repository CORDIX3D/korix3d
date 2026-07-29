import { createClient } from 'jsr:@supabase/supabase-js@2.58.0';

function getPublishableKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyKey) return legacyKey;

  const directKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (directKey) return directKey;

  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    const defaultKey = keys.default;
    return typeof defaultKey === 'string' ? defaultKey : null;
  } catch {
    return null;
  }
}

export async function isAdminRequest(request: Request) {
  const authorization = request.headers.get('authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getPublishableKey();

  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !publishableKey) {
    return false;
  }

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return false;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return !profileError && profile?.role === 'admin';
}
