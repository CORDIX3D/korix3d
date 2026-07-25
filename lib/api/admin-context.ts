import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';

function createAdminServiceClient() {
  const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type AdminApiContext = {
  adminClient: ReturnType<typeof createAdminServiceClient>;
  user: User;
};

type AdminApiResult =
  | { context: AdminApiContext; response?: never }
  | { context?: never; response: NextResponse };

export function adminApiUnavailableResponse() {
  return NextResponse.json(
    { error: 'Panel administracyjny jest chwilowo niedostępny.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    }
  );
}

export async function requireAdminApiContext(): Promise<AdminApiResult> {
  try {
    const sessionClient = await createClient();
    const { data: auth, error: authError } = await sessionClient.auth.getUser();

    if (authError && (authError.status || 0) >= 500) {
      console.error('Admin API authentication error:', authError);
      return { response: adminApiUnavailableResponse() };
    }

    if (!auth.user) {
      return {
        response: NextResponse.json(
          { error: 'Zaloguj się ponownie.' },
          { status: 401, headers: { 'Cache-Control': 'no-store' } }
        ),
      };
    }

    const { data: profile, error: profileError } = await sessionClient
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Admin API profile lookup error:', profileError);
      return { response: adminApiUnavailableResponse() };
    }

    if (profile?.role !== 'admin') {
      return {
        response: NextResponse.json(
          { error: 'Brak uprawnień administratora.' },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        ),
      };
    }

    return {
      context: {
        adminClient: createAdminServiceClient(),
        user: auth.user,
      },
    };
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Admin API context error:', error);
    }
    return { response: adminApiUnavailableResponse() };
  }
}
