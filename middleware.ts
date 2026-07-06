import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './lib/supabase/env';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey, isConfigured } = getSupabaseEnv();

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!isConfigured && process.env.NODE_ENV === 'development') {
    return supabaseResponse;
  }

  // Protected routes
  const isAdminRoute = pathname.startsWith('/admin');
  const isCustomerRoute = pathname.startsWith('/panel');
  const isAuthRoute = pathname.startsWith('/logowanie') ||
                     pathname.startsWith('/rejestracja') ||
                     pathname.startsWith('/odzyskaj-haslo') ||
                     pathname.startsWith('/auth/callback') ||
                     pathname.startsWith('/reset-password');

  // Redirect unauthenticated users from protected routes
  if (!user && (isAdminRoute || isCustomerRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/logowanie';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth routes
  if (user && isAuthRoute && !pathname.startsWith('/auth/callback') && !pathname.startsWith('/reset-password')) {
    // Check if user has admin role by fetching profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'customer';

    const url = request.nextUrl.clone();
    if (role === 'admin' || role === 'employee') {
      url.pathname = '/admin';
    } else {
      url.pathname = '/panel';
    }
    return NextResponse.redirect(url);
  }

  // Check admin access
  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'customer';

    if (role !== 'admin' && role !== 'employee') {
      const url = request.nextUrl.clone();
      url.pathname = '/panel';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need auth
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
