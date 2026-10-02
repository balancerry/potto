import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Pages that must work without a session (or before callback completes).
// '/pot/' is the read-only public share viewer (/pot/<token>). The trailing slash is
// load-bearing: matching '/pot' by prefix would also open the authenticated '/pots/...'.
// '/.well-known/' serves the app-link verification files that iOS/Android fetch signed out.
const PUBLIC_PREFIXES = ['/login', '/auth/callback', '/pot/', '/.well-known/'];

// Authenticated onboarding pages that must NOT bounce to home via the /login rule.
const AUTH_FLOW_PREFIXES = ['/auth/complete-signup', '/auth/reset-password', '/auth/set-password'];

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return '/';
  return value;
}

export async function proxy(request: NextRequest) {
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
    const next = safeNext(request.nextUrl.searchParams.get('next'));
    const url = request.nextUrl.clone();
    const queryAt = next.indexOf('?');
    url.pathname = queryAt === -1 ? next : next.slice(0, queryAt);
    url.search = queryAt === -1 ? '' : next.slice(queryAt);
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
    // opengraph-image has no file extension; link-preview crawlers fetch it signed out.
    '/((?!_next/static|_next/image|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
