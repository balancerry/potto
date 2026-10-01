'use server';

import { z } from 'zod';
import { canEditPot, canManagePoolMoney } from '@/lib/core/logic/permissions';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import {
  assertActiveMember,
  getCurrentMember,
  requireUser,
  revalidatePotPaths,
} from '@/lib/actions/_helpers';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export async function assignPoolManager(
  potId: string,
  memberId: string,
): Promise<ActionResult> {
  try {
    const member = z.string().uuid().parse(memberId);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);
    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canEditPot(me)) return actionFail('Only a pot admin can change the pool manager');

    const { error } = await auth.supabase.rpc('assign_pool_manager', {
      p_pot_id: potId,
      p_member_id: member,
    });
    if (error) return actionFail(error);
    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.number().int().positive(),
  date: dateStr,
  note: z.string().optional(),
});

export async function transferPoolMoney(
  potId: string,
  input: z.infer<typeof transferSchema>,
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const parsed = transferSchema.parse(input);
    if (parsed.fromAccountId === parsed.toAccountId) {
      return actionFail('Choose two different pool accounts');
    }
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);
    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));

    const { data: manager } = await auth.supabase
      .from('pot_pool_managers')
      .select('pot_member_id')
      .eq('pot_id', potId)
      .eq('active', true)
      .maybeSingle();
    if (!canManagePoolMoney(me, (manager?.pot_member_id as string | undefined) ?? null)) {
      return actionFail('Only the pool manager or a pot admin can transfer pool money');
    }

    const { data, error } = await auth.supabase.rpc('create_pool_transfer', {
      p_pot_id: potId,
      p_from_account_id: parsed.fromAccountId,
      p_to_account_id: parsed.toAccountId,
      p_amount: parsed.amount,
      p_date: parsed.date,
      p_note: parsed.note ?? null,
    });
    if (error) return actionFail(error);
    revalidatePotPaths(potId);
    return actionOk({ transactionId: data as string });
  } catch (err) {
    return actionFail(err);
  }
}
