import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRequiredSupabaseServiceEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
  return createClient(url, serviceRoleKey);
}

function validateContact(data: Record<string, unknown>) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const phone = String(data.phone || '').trim();
  const subject = String(data.subject || '').trim();
  const message = String(data.message || '').trim();

  if (name.length < 2 || name.length > 100) return 'Imię musi mieć od 2 do 100 znaków.';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return 'Podaj poprawny adres email.';
  if (phone && (phone.length > 30 || !/^[+\d\s()-]+$/.test(phone))) return 'Podaj poprawny numer telefonu.';
  if (subject.length < 3 || subject.length > 150) return 'Temat musi mieć od 3 do 150 znaków.';
  if (message.length < 10 || message.length > 5000) return 'Wiadomość musi mieć od 10 do 5000 znaków.';

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationError = validateContact(body);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('contact_submissions').insert([
      {
        name: String(body.name || '').trim(),
        email: String(body.email || '').trim().toLowerCase(),
        phone: String(body.phone || '').trim() || null,
        subject: String(body.subject || '').trim(),
        message: String(body.message || '').trim(),
        read: false,
        replied: false,
      },
    ]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form submit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się wysłać wiadomości.' },
      { status: 500 }
    );
  }
}
