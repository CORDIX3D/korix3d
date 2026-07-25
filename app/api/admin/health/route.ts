import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRuntimeHealth } from '@/lib/runtime-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 });
    }

    const health = getRuntimeHealth();
    return NextResponse.json(
      {
        status: health.status,
        provider: health.provider,
        commit: health.commit,
        services: health.services,
        capabilities: health.capabilities,
        checkedAt: health.checkedAt,
      },
      {
        status: health.healthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('Admin health check error:', error);
    return NextResponse.json(
      { error: 'Nie udało się sprawdzić stanu środowiska.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
