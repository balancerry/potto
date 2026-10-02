'use server';

import { revalidatePath } from 'next/cache';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import { requireUser } from '@/lib/actions/_helpers';
import { parsePublicShareState, type PublicShareState } from '@/lib/core/logic/public-pot';

// Authorization lives in the database: these RPCs check the caller is a pot
// member (read) or an owner/admin (enable/disable) and raise otherwise.

export async function getPublicShare(potId: string): Promise<ActionResult<PublicShareState>> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const { data, error } = await auth.supabase.rpc('get_pot_public_share', { p_pot_id: potId });
    if (error) return actionFail(error);
    return actionOk(parsePublicShareState(data));
  } catch (err) {
    return actionFail(err);
  }
}

/** Turns public sharing on. Idempotent: an existing live link is returned unchanged. */
export async function enablePublicShare(potId: string): Promise<ActionResult<PublicShareState>> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const { data, error } = await auth.supabase.rpc('enable_pot_public_share', { p_pot_id: potId });
    if (error) return actionFail(error);

    revalidatePath(`/pots/${potId}/settings`);
    return actionOk(parsePublicShareState(data));
  } catch (err) {
    return actionFail(err);
  }
}

/** Turns public sharing off; the old link stops working immediately and never works again. */
export async function disablePublicShare(potId: string): Promise<ActionResult<PublicShareState>> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const { error } = await auth.supabase.rpc('disable_pot_public_share', { p_pot_id: potId });
    if (error) return actionFail(error);

    revalidatePath(`/pots/${potId}/settings`);
    const { data, error: readError } = await auth.supabase.rpc('get_pot_public_share', { p_pot_id: potId });
    if (readError) return actionFail(readError);
    return actionOk(parsePublicShareState(data));
  } catch (err) {
    return actionFail(err);
  }
}
