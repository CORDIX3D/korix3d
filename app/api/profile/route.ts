import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import {
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import {
  normalizeProfileUpdate,
  profileUpdateSchema,
} from '@/lib/profile-schema';

export const dynamic = 'force-dynamic';

function unavailableResponse() {
  return NextResponse.json(
    { error: 'Edycja profilu jest chwilowo niedostępna.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    }
  );
}

function isAuthenticationServiceError(error: {
  name?: string;
  status?: number;
} | null) {
  return Boolean(
    error &&
      ((error.status ?? 0) >= 500 ||
        error.name === 'AuthRetryableFetchError' ||
        error.name === 'AuthUnknownError')
  );
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (isAuthenticationServiceError(authError)) {
      return unavailableResponse();
    }
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Zaloguj się ponownie.' },
        { status: 401 }
      );
    }

    const body = await readJsonObject(request, 32 * 1024);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            'Sprawdź poprawność danych profilu.',
        },
        { status: 400 }
      );
    }

    const payload = {
      ...normalizeProfileUpdate(parsed.data),
      updated_at: new Date().toISOString(),
    };
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', auth.user.id)
      .select(
        'id, email, full_name, phone, company, nip, address_street, address_city, address_zip, address_country, role, avatar_url, created_at, updated_at'
      )
      .maybeSingle();

    if (error) {
      console.error('Customer profile update error:', error);
      return NextResponse.json(
        { error: 'Nie udało się zapisać danych profilu.' },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'Nie znaleziono profilu użytkownika.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, profile },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (isSupabaseConfigurationError(error)) {
      return unavailableResponse();
    }

    console.error('Customer profile route error:', error);
    return unavailableResponse();
  }
}
