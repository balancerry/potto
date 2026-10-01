import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

export interface AuthUser {
  id: string;
  email: string | null;
  /** Name captured at sign-up (auth user_metadata); prefer the `users` profile name when loaded. */
  metadataName: string | null;
}

/**
 * Server Supabase client (App Router). Creates a fresh client per call;
 * cookie writes may no-op in Server Components — proxy should refresh sessions.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — ignore; proxy handles refresh.
          }
        },
      },
    },
  );
}

/**
 * Signed-in user for Server Components, or null. Verifies the session JWT locally
 * (asymmetric signing keys) instead of calling the Auth server, and is cached per
 * request so layouts, pages and loaders share one check.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const name = claims.user_metadata?.name;
  return {
    id: claims.sub,
    email: claims.email ?? null,
    metadataName: typeof name === 'string' ? name : null,
  };
});
