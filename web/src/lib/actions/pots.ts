'use server';

import { z } from 'zod';
import { generateInviteCode, generateJoinCode } from '@/lib/core/logic/invites';
import { canEditPot, canArchivePot } from '@/lib/core/logic/permissions';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import {
  assertAdmin,
  getCurrentMember,
  requireUser,
  revalidatePotPaths,
} from '@/lib/actions/_helpers';

const createPotSchema = z.object({
  name: z.string().trim().min(1, 'Enter a pot name'),
  description: z.string().trim().optional(),
  memberNames: z.array(z.string()).default([]),
  startingContributionPaise: z.number().int().positive().optional(),
  expectedContributionPaise: z.number().int().positive().optional(),
});

const updateDetailsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  expectedContributionPerMember: z.number().int().positive().nullable().optional(),
});

export async function createPot(input: z.infer<typeof createPotSchema>): Promise<ActionResult<{ potId: string }>> {
  try {
    const parsed = createPotSchema.parse(input);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const { data: potId, error } = await auth.supabase.rpc('create_pot', {
      p_name: parsed.name,
      p_description: parsed.description ?? null,
      p_member_names: parsed.memberNames.filter((n) => n.trim().length > 0),
      p_starting_contribution: parsed.startingContributionPaise ?? null,
      p_expected_contribution_per_member: parsed.expectedContributionPaise ?? null,
    });

    if (error) return actionFail(error);
    if (!potId || typeof potId !== 'string') return actionFail('Failed to create pot');

    revalidatePotPaths(potId);
    return actionOk({ potId });
  } catch (err) {
    return actionFail(err);
  }
}

export async function updatePotDetails(
  potId: string,
  updates: z.infer<typeof updateDetailsSchema>,
): Promise<ActionResult> {
  try {
    const parsed = updateDetailsSchema.parse(updates);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canEditPot(me)) return actionFail('You do not have permission to do that');

    const patch: Record<string, unknown> = {};
    if (parsed.name !== undefined) patch.name = parsed.name;
    if (parsed.description !== undefined) {
      patch.description = parsed.description === '' || parsed.description === null ? null : parsed.description;
    }
    if (parsed.expectedContributionPerMember !== undefined) {
      patch.expected_contribution_per_member = parsed.expectedContributionPerMember;
    }
    if (Object.keys(patch).length === 0) return actionOk();

    const { error } = await auth.supabase.from('pots').update(patch).eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function archivePot(potId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canArchivePot(me)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase.from('pots').update({ status: 'archived' }).eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function deletePot(potId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    assertAdmin(me);

    const { error } = await auth.supabase.from('pots').delete().eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function setInviteEnabled(potId: string, enabled: boolean): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canEditPot(me)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase.from('pots').update({ invite_enabled: enabled }).eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function regenerateInviteCode(potId: string): Promise<ActionResult<{ inviteCode: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canEditPot(me)) return actionFail('You do not have permission to do that');

    const { data: rows, error: listErr } = await auth.supabase.from('pots').select('invite_code');
    if (listErr) return actionFail(listErr);

    const existing = new Set((rows ?? []).map((r) => r.invite_code as string));
    const inviteCode = generateInviteCode(existing);

    const { error } = await auth.supabase.from('pots').update({ invite_code: inviteCode }).eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk({ inviteCode });
  } catch (err) {
    return actionFail(err);
  }
}

export async function setJoinEnabled(potId: string, enabled: boolean): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canEditPot(me)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase.from('pots').update({ join_enabled: enabled }).eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function regenerateJoinCode(potId: string): Promise<ActionResult<{ joinCode: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canEditPot(me)) return actionFail('You do not have permission to do that');

    const { data: rows, error: listErr } = await auth.supabase.from('pots').select('join_code');
    if (listErr) return actionFail(listErr);

    const existing = new Set((rows ?? []).map((r) => r.join_code as string));
    const joinCode = generateJoinCode(existing);

    const { error } = await auth.supabase.from('pots').update({ join_code: joinCode }).eq('id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk({ joinCode });
  } catch (err) {
    return actionFail(err);
  }
}
