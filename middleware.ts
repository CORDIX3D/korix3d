import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  canAccessAdminPath,
  getAdminHomePath,
  isStaffRole,
} from '@/lib/admin-access';
import { inspectPublicSupabaseEnvironment } from '@/lib/env/public';
import {
  crossSiteRequestResponse,
  isTrustedMutationRequest,
} from '@/lib/api/request-security';

function createUnavailableResponse(
  request: NextRequest,
  options: { api: boolean; returnTo?: string }
) {
  if (options.api) {
    return NextResponse.json(
      { error: 'Usługa administracyjna jest chwilowo niedostępna.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      }
    );
  }

  const unavailableUrl = request.nextUrl.clone();
  unavailableUrl.pathname = '/api/service-unavailable';
  unavailableUrl.search = '';
  unavailableUrl.searchParams.set('returnTo', options.returnTo || request.nextUrl.pathname);

  return NextResponse.rewrite(unavailableUrl, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Retry-After': '60',
    },
  });
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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isCustomerRoute = pathname.startsWith('/panel');
  const isProtectedPage = isAdminRoute || isCustomerRoute;
  const isPrivateApiRoute =
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/accounting') ||
    pathname.startsWith('/api/executive');
  const isAuthRoute =
    pathname.startsWith('/logowanie') ||
    pathname.startsWith('/rejestracja') ||
    pathname.startsWith('/odzyskaj-haslo') ||
    pathname.startsWith('/reset-password');

  if (isPrivateApiRoute && !isTrustedMutationRequest(request)) {
    return crossSiteRequestResponse();
  }
  const environment = inspectPublicSupabaseEnvironment();
  const supabaseUrl = environment.values?.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = environment.values?.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase env vars missing — protected features are unavailable.');
      return NextResponse.next({ request });
    }

    if (isPrivateApiRoute || isProtectedPage || isAuthRoute) {
      return createUnavailableResponse(request, {
        api: isPrivateApiRoute,
        returnTo: pathname,
      });
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

  let authResult;
  try {
    authResult = await supabase.auth.getUser();
  } catch (error) {
    console.error('Supabase authentication check failed:', error);
    return createUnavailableResponse(request, {
      api: isPrivateApiRoute,
      returnTo: pathname,
    });
  }

  if (isAuthenticationServiceError(authResult.error)) {
    console.error('Supabase authentication service error:', authResult.error);
    return createUnavailableResponse(request, {
      api: isPrivateApiRoute,
      returnTo: pathname,
    });
  }

  const user = authResult.data.user;

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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Supabase profile lookup failed:', profileError);
      return createUnavailableResponse(request, {
        api: false,
        returnTo: pathname,
      });
    }

    const role = profile?.role || 'customer';

    const url = request.nextUrl.clone();
    if (isStaffRole(role)) {
      url.pathname = getAdminHomePath(role);
    } else {
      url.pathname = '/panel';
    }
    return NextResponse.redirect(url);
  }

  // Check admin access
  if (user && isAdminRoute) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Supabase profile lookup failed:', profileError);
      return createUnavailableResponse(request, {
        api: false,
        returnTo: pathname,
      });
    }

    const role = profile?.role || 'customer';

    if (!isStaffRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = '/panel';
      return NextResponse.redirect(url);
    }

    if (!canAccessAdminPath(role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = getAdminHomePath(role);
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/admin/:path*',
    '/panel/:path*',
    '/logowanie',
    '/rejestracja',
    '/odzyskaj-haslo',
    '/reset-password',
    '/api/admin/:path*',
    '/api/accounting/:path*',
    '/api/executive/:path*',
  ],
};
