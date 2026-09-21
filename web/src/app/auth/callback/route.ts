import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

/**
 * Handles PKCE auth redirects for:
 * - magic-link login (`next=/`)
 * - signup verification (`next=/auth/complete-signup`)
 * - password recovery (`next=/auth/reset-password`)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Recovery / magic links sometimes land with error params when expired.
  const errorDescription = searchParams.get('error_description') ?? searchParams.get('error');
  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
