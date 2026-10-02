import { supabase } from '@/lib/supabase';
import {
  isPlausiblePublicToken,
  parsePublicPotResponse,
  parsePublicShareState,
  type PublicPotResult,
  type PublicShareState,
} from '@/logic/public-pot';

/**
 * Sanitized, read-only snapshot of a shared pot. Needs no account: `get_public_pot`
 * is callable by the anonymous role and returns an allow-listed payload only
 * (see backend migration 0019). Throws on transport errors so screens can offer Retry.
 */
export async function fetchPublicPot(token: string): Promise<PublicPotResult> {
  if (!isPlausiblePublicToken(token)) return { status: 'not_found' };

  const { data, error } = await supabase.rpc('get_public_pot', { p_token: token });
  if (error) throw new Error(error.message);
  return parsePublicPotResponse(data);
}

// Authorization lives in the database: these RPCs check the caller is a pot member (read)
// or an owner/admin (enable/disable) and raise otherwise.

export async function fetchPublicShare(potId: string): Promise<PublicShareState> {
  const { data, error } = await supabase.rpc('get_pot_public_share', { p_pot_id: potId });
  if (error) throw new Error(error.message);
  return parsePublicShareState(data);
}

/** Turns public sharing on. Idempotent: an existing live link is returned unchanged. */
export async function enablePublicShare(potId: string): Promise<PublicShareState> {
  const { data, error } = await supabase.rpc('enable_pot_public_share', { p_pot_id: potId });
  if (error) throw new Error(error.message);
  return parsePublicShareState(data);
}

/** Turns sharing off; the old link stops working immediately and never works again. */
export async function disablePublicShare(potId: string): Promise<PublicShareState> {
  const { error } = await supabase.rpc('disable_pot_public_share', { p_pot_id: potId });
  if (error) throw new Error(error.message);
  return fetchPublicShare(potId);
}
