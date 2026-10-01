// Read as literals: Next.js only inlines `process.env.NEXT_PUBLIC_*` when the
// reference is static, so these cannot be looked up by a dynamic key.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase connection details, validated at call time.
 *
 * Throws with the missing variable's name instead of letting @supabase/ssr fail
 * with a generic message — a missing value in middleware otherwise surfaces as
 * an opaque 500 MIDDLEWARE_INVOCATION_FAILED.
 */
export function supabaseEnv(): { url: string; anonKey: string } {
  if (!url) throw new Error(missing('NEXT_PUBLIC_SUPABASE_URL'));
  if (!anonKey) throw new Error(missing('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  return { url, anonKey };
}

function missing(name: string): string {
  return `Missing ${name}. Set it in web/.env.local for local development, or in the Vercel project's Environment Variables (Production, Preview and Development) and redeploy.`;
}
