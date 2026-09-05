import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { isStaffRole } from '@/lib/admin-access';
import { getRequiredSupabaseServiceEnv, isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const ANALYTICS_TABLES = [
  ['products', 'Produkty'],
  ['orders_3d', 'Zamówienia 3D'],
  ['store_orders', 'Zamówienia sklepu'],
  ['filaments', 'Filamenty'],
  ['materials', 'Materiały'],
  ['contact_submissions', 'Wiadomości'],
  ['blog_posts', 'Blog'],
  ['faq_items', 'FAQ'],
] as const;

function unavailable() {
  return NextResponse.json(
    { error: 'Analityka jest chwilowo niedostępna.' },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
  );
}

export async function GET() {
  try {
    const session = await createClient();
    const { data: auth } = await session.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await session
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!isStaffRole(profile?.role)) {
      return NextResponse.json({ error: 'Brak uprawnień pracownika.' }, { status: 403 });
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createServiceRoleClient(url, serviceRoleKey, auth.user.id);
    const counts = await Promise.all(ANALYTICS_TABLES.map(async ([table, label]) => {
      const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true });
      if (error) throw error;
      return [label, count ?? 0] as const;
    }));

    return NextResponse.json(
      { stats: Object.fromEntries(counts) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Admin analytics error:', error);
    }
    return unavailable();
  }
}
