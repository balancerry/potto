import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Auth pages that must work without a session (or before callback completes).
const PUBLIC_PREFIXES = ['/login', '/auth/callback'];

// Authenticated onboarding pages that must NOT bounce to home via the /login rule.
const AUTH_FLOW_PREFIXES = ['/auth/complete-signup', '/auth/reset-password', '/auth/set-password'];

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  const isAuthFlow = AUTH_FLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Allow auth-flow pages for signed-in users (don't treat as normal app chrome).
  if (user && isAuthFlow) {
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
