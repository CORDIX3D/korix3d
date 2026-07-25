import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
  return createClient(url, serviceRoleKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, 4 * 1024);
    const normalizedEmail = String(body.email || '').trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json({ error: 'Podaj poprawny adres email.' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('newsletter_subscribers').insert([
      {
        email: normalizedEmail,
        source: 'footer',
        active: true,
      },
    ]);

    if (error?.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true });
    }

    if (error) throw error;

    return NextResponse.json({ success: true, duplicate: false });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Newsletter jest chwilowo niedostępny.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    console.error('Newsletter subscribe error:', error);
    return NextResponse.json(
      { error: 'Nie udało się zapisać do newslettera. Spróbuj ponownie za chwilę.' },
      { status: 500 }
    );
  }
}
