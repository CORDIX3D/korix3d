import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Brak konfiguracji Supabase.');
  }

  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
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
    console.error('Newsletter subscribe error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zapisać do newslettera.' },
      { status: 500 }
    );
  }
}
