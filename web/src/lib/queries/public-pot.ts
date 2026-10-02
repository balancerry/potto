import { cache } from 'react';
import {
  isPlausiblePublicToken,
  parsePublicPotResponse,
  parsePublicShareState,
  type PublicPotResult,
  type PublicShareState,
} from '@/lib/core/logic/public-pot';
import { createAnonClient, createClient } from '@/lib/supabase/server';

/**
 * Sanitized, read-only snapshot of a shared pot, looked up by its public token.
 *
 * Needs no account: the `get_public_pot` RPC is callable by the anonymous role
 * and returns only an allow-listed payload (see migration 0019). A signed-in
 * visitor's session is attached only so the RPC can tell a pot member they
 * already have the full app. If that session is rejected we retry as anonymous.
 *
 * Cached per request so `generateMetadata` and the page share one round trip.
 * Throws on transport errors so the route's error boundary offers a retry.
 */
export const getPublicPot = cache(async (token: string): Promise<PublicPotResult> => {
  if (!isPlausiblePublicToken(token)) return { status: 'not_found' };

  const supabase = await createClient();
  let { data, error } = await supabase.rpc('get_public_pot', { p_token: token });

  if (error && (error.code === 'PGRST301' || /jwt/i.test(error.message))) {
    ({ data, error } = await createAnonClient().rpc('get_public_pot', { p_token: token }));
  }
  if (error) throw new Error(error.message);

  return parsePublicPotResponse(data);
});

/** Share-link state for the pot's Share sheet. Any active member may call it. */
export async function getPotPublicShare(potId: string): Promise<PublicShareState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_pot_public_share', { p_pot_id: potId });
  if (error) throw new Error(error.message);
  return parsePublicShareState(data);
}
