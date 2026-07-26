import { NextRequest, NextResponse } from 'next/server';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/api/public-rate-limit';
import { createServiceRoleClient } from '@/lib/supabase/service-client';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
  return createServiceRoleClient(url, serviceRoleKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request, 4 * 1024);
    const normalizedEmail = String(body.email || '').trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json({ error: 'Podaj poprawny adres email.' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const rateLimit = await checkPublicRateLimit(request, {
      scope: 'newsletter_form',
      limit: 5,
      windowSeconds: 60 * 60,
      consumePersistent: async (args) => {
        const { data, error } = await supabase.rpc('consume_public_api_rate_limit', args);
        return { data: data === true, error };
      },
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(
        'Wysłano zbyt wiele zapisów. Spróbuj ponownie później.',
        rateLimit.retryAfter
      );
    }

    const { data: existing, error: lookupError } = await supabase
      .from('newsletter_subscribers')
      .select('active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing) {
      if (existing.active === true) {
        return NextResponse.json({ success: true, duplicate: true });
      }

      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({
          active: true,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        })
        .eq('email', normalizedEmail);

      if (updateError) throw updateError;
      return NextResponse.json({ success: true, duplicate: false, reactivated: true });
    }

    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: normalizedEmail,
      source: 'footer',
      active: true,
    });

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
