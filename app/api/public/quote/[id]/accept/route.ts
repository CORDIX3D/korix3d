import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADERS = { 'Cache-Control': 'no-store' } as const;

type DatabaseError = {
  code?: string;
  message?: string;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: 'Niepoprawny identyfikator wyceny.' },
        { status: 400, headers: HEADERS }
      );
    }

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError && (authError.status || 0) >= 500) throw authError;
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Zaloguj się ponownie.' },
        { status: 401, headers: HEADERS }
      );
    }

    const { data: accepted, error } = await supabase.rpc('accept_order_quote', {
      p_order_id: id,
    });

    if (error) {
      const databaseError = error as DatabaseError;
      if (
        databaseError.code === '23514'
        && databaseError.message?.includes('insufficient filament stock')
      ) {
        return NextResponse.json(
          {
            error: 'Wybrany filament nie wystarcza już na realizację tego zlecenia. Skontaktujemy się z Tobą w sprawie zamiennika.',
          },
          { status: 409, headers: HEADERS }
        );
      }

      if (databaseError.code === '23514') {
        return NextResponse.json(
          { error: 'Wycena nie jest jeszcze gotowa do akceptacji.' },
          { status: 409, headers: HEADERS }
        );
      }

      throw error;
    }

    if (!accepted) {
      return NextResponse.json(
        { error: 'Ta wycena została już zaakceptowana albo nie jest aktualna.' },
        { status: 409, headers: HEADERS }
      );
    }

    return NextResponse.json(
      { success: true, status: 'accepted' },
      { headers: HEADERS }
    );
  } catch (error) {
    if (!isSupabaseConfigurationError(error)) {
      console.error('Public quote acceptance error:', error);
    }
    return NextResponse.json(
      { error: 'Nie udało się zaakceptować wyceny. Spróbuj ponownie.' },
      {
        status: 503,
        headers: {
          ...HEADERS,
          'Retry-After': '5',
        },
      }
    );
  }
}
