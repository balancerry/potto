'use server';

import { z } from 'zod';
import type { JoinChannel } from '@/lib/core/logic/join-requests';
import { canManageMembers, canReviewJoinRequests } from '@/lib/core/logic/permissions';
import { mapMember, type MemberRow, type PotRow } from '@/lib/mappers';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import {
  assertAdmin,
  getCurrentMember,
  requireUser,
  revalidatePotPaths,
} from '@/lib/actions/_helpers';

const accessLevelSchema = z.enum(['member', 'view_only']);

export async function requestToJoin(
  potId: string,
  requestedName: string,
  channel: JoinChannel = 'invite_link',
): Promise<ActionResult<{ joinRequestId: string; status: 'created' | 'already_pending' | 'already_member' }>> {
  try {
    const name = z.string().trim().min(1, 'Enter your name').parse(requestedName);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    // Non-members usually cannot SELECT pots (RLS). When the row is visible, enforce
    // archived/enabled checks; otherwise rely on the prior resolve_invite/join_code step
    // in the UI and let the FK reject a bad potId.
    const { data: potRow } = await auth.supabase.from('pots').select('*').eq('id', potId).maybeSingle();
    if (potRow) {
      const pot = potRow as PotRow;
      if (pot.status === 'archived') return actionFail('This pot is archived');
      if (channel === 'join_code') {
        if (!pot.join_enabled) return actionFail('Join code is disabled for this pot');
      } else if (!pot.invite_enabled) {
        return actionFail('Invite link is disabled for this pot');
      }
    }

    const existingMember = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (existingMember) {
      return actionOk({ joinRequestId: existingMember.id, status: 'already_member' });
    }

    const { data: pending } = await auth.supabase
      .from('join_requests')
      .select('id')
      .eq('pot_id', potId)
      .eq('user_id', auth.user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pending) {
      return actionOk({ joinRequestId: pending.id as string, status: 'already_pending' });
    }

    const { data: created, error } = await auth.supabase
      .from('join_requests')
      .insert({
        pot_id: potId,
        user_id: auth.user.id,
        requested_name: name,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk({ joinRequestId: created.id as string, status: 'created' });
  } catch (err) {
    return actionFail(err);
  }
}

export async function approveExistingMember(input: {
  potId: string;
  joinRequestId: string;
  memberId: string;
  accessLevel: 'member' | 'view_only';
}): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = z
      .object({
        potId: z.string().uuid(),
        joinRequestId: z.string().uuid(),
        memberId: z.string().uuid(),
        accessLevel: accessLevelSchema,
      })
      .parse(input);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, parsed.potId, auth.user.id);
    if (!canReviewJoinRequests(me)) return actionFail('You do not have permission to do that');

    const { data, error } = await auth.supabase.rpc('approve_join_request', {
      p_join_request_id: parsed.joinRequestId,
      p_target_member_id: parsed.memberId,
      p_new_member_display_name: null,
      p_access_level: parsed.accessLevel,
    });

    if (error) return actionFail(error);

    const member = data ? mapMember(data as MemberRow) : null;
    revalidatePotPaths(parsed.potId);
    return actionOk({ memberId: member?.id ?? parsed.memberId });
  } catch (err) {
    return actionFail(err);
  }
}

export async function approveNewMember(input: {
  potId: string;
  joinRequestId: string;
  displayName: string;
  accessLevel: 'member' | 'view_only';
}): Promise<ActionResult<{ memberId: string }>> {
  try {
    const parsed = z
      .object({
        potId: z.string().uuid(),
        joinRequestId: z.string().uuid(),
        displayName: z.string().trim().min(1),
        accessLevel: accessLevelSchema,
      })
      .parse(input);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, parsed.potId, auth.user.id);
    if (!canReviewJoinRequests(me)) return actionFail('You do not have permission to do that');

    const { data, error } = await auth.supabase.rpc('approve_join_request', {
      p_join_request_id: parsed.joinRequestId,
      p_target_member_id: null,
      p_new_member_display_name: parsed.displayName,
      p_access_level: parsed.accessLevel,
    });

    if (error) return actionFail(error);

    const member = data ? mapMember(data as MemberRow) : null;
    if (!member) return actionFail('Failed to create member');

    revalidatePotPaths(parsed.potId);
    return actionOk({ memberId: member.id });
  } catch (err) {
    return actionFail(err);
  }
}

export async function rejectJoinRequest(input: {
  potId: string;
  joinRequestId: string;
}): Promise<ActionResult> {
  try {
    const parsed = z
      .object({
        potId: z.string().uuid(),
        joinRequestId: z.string().uuid(),
      })
      .parse(input);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, parsed.potId, auth.user.id);
    if (!canReviewJoinRequests(me)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase.rpc('reject_join_request', {
      p_join_request_id: parsed.joinRequestId,
    });
    if (error) return actionFail(error);

    revalidatePotPaths(parsed.potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function removeMember(potId: string, memberId: string): Promise<ActionResult> {
  try {
    z.string().uuid().parse(potId);
    z.string().uuid().parse(memberId);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = await getCurrentMember(auth.supabase, potId, auth.user.id);
    if (!canManageMembers(me)) return actionFail('You do not have permission to do that');
    const admin = assertAdmin(me);

    if (admin.id === memberId) return actionFail('You cannot remove yourself');

    const { error } = await auth.supabase
      .from('pot_members')
      .update({ status: 'inactive', user_id: null })
      .eq('id', memberId)
      .eq('pot_id', potId);

    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}
