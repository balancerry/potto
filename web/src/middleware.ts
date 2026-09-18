import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Join/invite live under (app) and require auth; middleware sends users to login?next=…
const PUBLIC_PREFIXES = ['/login', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

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

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
