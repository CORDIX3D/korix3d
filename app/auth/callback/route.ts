import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isPathWithin, normalizeInternalPath } from '@/lib/navigation';

export const dynamic = 'force-dynamic';
const ALLOWED_CALLBACK_PATHS = ['/panel', '/reset-password'] as const;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get('code');
  const requestedNext = normalizeInternalPath(searchParams.get('next'), '/panel');
  const next = isPathWithin(requestedNext, ALLOWED_CALLBACK_PATHS)
    ? requestedNext
    : '/panel';

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }

      if ((error.status ?? 0) >= 500) {
        return NextResponse.redirect(
          new URL('/serwis-niedostepny?returnTo=/logowanie', origin)
        );
      }

      console.error('Supabase callback exchange rejected:', {
        name: error.name,
        status: error.status,
      });
    } catch (error) {
      console.error('Supabase callback exchange unavailable:', error);
      return NextResponse.redirect(
        new URL('/serwis-niedostepny?returnTo=/logowanie', origin)
      );
    }
  }

  return NextResponse.redirect(
    new URL('/logowanie?error=callback_error', origin)
  );
}
