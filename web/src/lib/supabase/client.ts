import { createBrowserClient } from '@supabase/ssr';
import { supabaseEnv } from './env';

/** Browser Supabase client for Client Components. */
export function createClient() {
  const { url, anonKey } = supabaseEnv();

  return createBrowserClient(
    url,
    anonKey,
  );
}
