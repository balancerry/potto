'use server';

import { z } from 'zod';
import {
  canAddExpense,
  canAddMoney,
  canDeleteTransaction,
  canEditTransaction,
  canSettle,
} from '@/lib/core/logic/permissions';
import type { PaymentMethod, SplitMethod } from '@/lib/core/models';
import { mapTransaction, type TransactionRow } from '@/lib/mappers';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import {
  assertActiveMember,
  getCurrentMember,
  requireUser,
  revalidatePotPaths,
} from '@/lib/actions/_helpers';

const paise = z.number().int().positive();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

const contributionEntrySchema = z.object({
  memberId: z.string().uuid(),
  amount: paise,
});

const addMoneySchema = z.object({
  date: dateStr,
  note: z.string().optional(),
  entries: z.array(contributionEntrySchema).min(1),
});

const splitSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
});

const addExpenseSchema = z.object({
  description: z.string().trim().min(1),
  amount: paise,
  paidBy: z.string().uuid(),
  paymentSource: z.enum(['pool', 'personal']),
  date: dateStr,
  category: z.string().optional(),
  participants: z.array(z.string().uuid()).min(1),
  splitMethod: z.enum(['equal', 'custom', 'percentage']),
  splits: z.array(splitSchema).min(1),
  note: z.string().optional(),
});

const updateContributionSchema = z.object({
  memberId: z.string().uuid(),
  amount: paise,
  date: dateStr,
  note: z.string().optional(),
});

const updateSettlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: paise,
  date: dateStr,
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional(),
  note: z.string().optional(),
});

const recordSettlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: paise,
  date: dateStr.optional(),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'other']).optional(),
  note: z.string().optional(),
});

async function loadTransaction(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  potId: string,
  txId: string,
) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', txId)
    .eq('pot_id', potId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapTransaction(data as TransactionRow, []);
}

async function replaceSplits(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  transactionId: string,
  splits: { memberId: string; amount: number }[],
) {
  const { error: delErr } = await supabase.from('transaction_splits').delete().eq('transaction_id', transactionId);
  if (delErr) throw delErr;
  if (splits.length === 0) return;
  const { error: insErr } = await supabase.from('transaction_splits').insert(
    splits.map((s) => ({
      transaction_id: transactionId,
      member_id: s.memberId,
      amount: s.amount,
    })),
  );
  if (insErr) throw insErr;
}

export async function addMoney(
  potId: string,
  input: z.infer<typeof addMoneySchema>,
): Promise<ActionResult<{ transactionIds: string[] }>> {
  try {
    const parsed = addMoneySchema.parse(input);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canAddMoney(me)) return actionFail('You do not have permission to do that');

    const rows = parsed.entries.map((entry) => ({
      pot_id: potId,
      type: 'contribution' as const,
      description: 'Contribution',
      amount: entry.amount,
      date: parsed.date,
      paid_by: entry.memberId,
      // RLS requires created_by = current member
      created_by: me.id,
      note: parsed.note ?? null,
    }));

    const { data, error } = await auth.supabase.from('transactions').insert(rows).select('id');
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk({ transactionIds: (data ?? []).map((r) => r.id as string) });
  } catch (err) {
    return actionFail(err);
  }
}

export async function addExpense(
  potId: string,
  input: z.infer<typeof addExpenseSchema>,
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const parsed = addExpenseSchema.parse(input);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canAddExpense(me)) return actionFail('You do not have permission to do that');

    const type = parsed.paymentSource === 'pool' ? 'pool_expense' : 'member_expense';

    const { data: tx, error } = await auth.supabase
      .from('transactions')
      .insert({
        pot_id: potId,
        type,
        description: parsed.description,
        amount: parsed.amount,
        date: parsed.date,
        paid_by: parsed.paidBy,
        payment_source: parsed.paymentSource,
        category: parsed.category ?? null,
        participants: parsed.participants,
        split_method: parsed.splitMethod as SplitMethod,
        note: parsed.note ?? null,
        created_by: me.id,
      })
      .select('*')
      .single();

    if (error) return actionFail(error);

    await replaceSplits(auth.supabase, tx.id, parsed.splits);

    revalidatePotPaths(potId);
    return actionOk({ transactionId: tx.id as string });
  } catch (err) {
    return actionFail(err);
  }
}

export async function updateContribution(
  potId: string,
  txId: string,
  updates: z.infer<typeof updateContributionSchema>,
): Promise<ActionResult> {
  try {
    const parsed = updateContributionSchema.parse(updates);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    const existing = await loadTransaction(auth.supabase, potId, txId);
    if (!existing || existing.type !== 'contribution') return actionFail('Contribution not found');
    if (!canEditTransaction(me, existing)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase
      .from('transactions')
      .update({
        paid_by: parsed.memberId,
        amount: parsed.amount,
        date: parsed.date,
        note: parsed.note ?? null,
      })
      .eq('id', txId)
      .eq('pot_id', potId);

    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function updateExpense(
  potId: string,
  txId: string,
  updates: z.infer<typeof addExpenseSchema>,
): Promise<ActionResult> {
  try {
    const parsed = addExpenseSchema.parse(updates);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    const existing = await loadTransaction(auth.supabase, potId, txId);
    if (!existing || (existing.type !== 'pool_expense' && existing.type !== 'member_expense')) {
      return actionFail('Expense not found');
    }
    if (!canEditTransaction(me, existing)) return actionFail('You do not have permission to do that');

    const type = parsed.paymentSource === 'pool' ? 'pool_expense' : 'member_expense';

    const { error } = await auth.supabase
      .from('transactions')
      .update({
        type,
        description: parsed.description,
        amount: parsed.amount,
        date: parsed.date,
        paid_by: parsed.paidBy,
        payment_source: parsed.paymentSource,
        category: parsed.category ?? null,
        participants: parsed.participants,
        split_method: parsed.splitMethod,
        note: parsed.note ?? null,
      })
      .eq('id', txId)
      .eq('pot_id', potId);

    if (error) return actionFail(error);

    await replaceSplits(auth.supabase, txId, parsed.splits);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function updateSettlement(
  potId: string,
  txId: string,
  updates: z.infer<typeof updateSettlementSchema>,
): Promise<ActionResult> {
  try {
    const parsed = updateSettlementSchema.parse(updates);
    if (parsed.fromMemberId === parsed.toMemberId) {
      return actionFail('Settlement must be between two different members');
    }

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    const existing = await loadTransaction(auth.supabase, potId, txId);
    if (!existing || existing.type !== 'settlement') return actionFail('Settlement not found');
    if (!canEditTransaction(me, existing)) return actionFail('You do not have permission to do that');

    const { data: members } = await auth.supabase
      .from('pot_members')
      .select('id, display_name')
      .eq('pot_id', potId)
      .in('id', [parsed.fromMemberId, parsed.toMemberId]);

    const nameOf = (id: string) => members?.find((m) => m.id === id)?.display_name ?? '';

    const { error } = await auth.supabase
      .from('transactions')
      .update({
        description: `${nameOf(parsed.fromMemberId)} → ${nameOf(parsed.toMemberId)}`,
        amount: parsed.amount,
        date: parsed.date,
        paid_by: parsed.fromMemberId,
        to_member: parsed.toMemberId,
        payment_method: (parsed.paymentMethod as PaymentMethod | undefined) ?? null,
        note: parsed.note ?? null,
      })
      .eq('id', txId)
      .eq('pot_id', potId);

    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function deleteTransaction(potId: string, txId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    const existing = await loadTransaction(auth.supabase, potId, txId);
    if (!existing) return actionFail('Transaction not found');
    if (!canDeleteTransaction(me, existing)) return actionFail('You do not have permission to do that');

    // commitment_payments.transaction_id ON DELETE CASCADE removes links automatically.
    const { error } = await auth.supabase.from('transactions').delete().eq('id', txId).eq('pot_id', potId);
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function recordSettlement(
  potId: string,
  input: z.infer<typeof recordSettlementSchema>,
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const parsed = recordSettlementSchema.parse(input);
    if (parsed.fromMemberId === parsed.toMemberId) {
      return actionFail('Settlement must be between two different members');
    }

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canSettle(me)) return actionFail('You do not have permission to do that');

    const { data: members } = await auth.supabase
      .from('pot_members')
      .select('id, display_name')
      .eq('pot_id', potId)
      .in('id', [parsed.fromMemberId, parsed.toMemberId]);

    if ((members ?? []).length !== 2) return actionFail('Both members must belong to this pot');

    const nameOf = (id: string) => members?.find((m) => m.id === id)?.display_name ?? '';
    const date = parsed.date ?? new Date().toISOString().slice(0, 10);

    const { data: tx, error } = await auth.supabase
      .from('transactions')
      .insert({
        pot_id: potId,
        type: 'settlement',
        description: `${nameOf(parsed.fromMemberId)} → ${nameOf(parsed.toMemberId)}`,
        amount: parsed.amount,
        date,
        paid_by: parsed.fromMemberId,
        to_member: parsed.toMemberId,
        payment_method: parsed.paymentMethod ?? null,
        note: parsed.note ?? null,
        created_by: me.id,
      })
      .select('id')
      .single();

    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk({ transactionId: tx.id as string });
  } catch (err) {
    return actionFail(err);
  }
}
