import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server Supabase client (App Router). Creates a fresh client per call;
 * cookie writes may no-op in Server Components — middleware should refresh sessions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // Called from a Server Component — ignore; middleware handles refresh.
          }
        },
      },
    },
  );
}
