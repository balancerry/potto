'use server';

import { z } from 'zod';
import {
  calculateCommitmentPaid,
  validateCommitmentPaymentAmount,
  validateCommitmentTotalAmount,
} from '@/lib/core/logic/commitments';
import {
  canAddCommitmentPayment,
  canCancelCommitment,
  canCreateCommitment,
  canEditCommitment,
} from '@/lib/core/logic/permissions';
import type { SplitMethod } from '@/lib/core/models';
import {
  mapCommitment,
  mapTransaction,
  type CommitmentPaymentRow,
  type CommitmentRow,
  type TransactionRow,
} from '@/lib/mappers';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import {
  assertActiveMember,
  getCurrentMember,
  requireUser,
  revalidatePotPaths,
} from '@/lib/actions/_helpers';

const paise = z.number().int().positive();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const commitmentFields = z.object({
  title: z.string().trim().min(1, 'Enter a title'),
  vendorName: z.string().trim().optional(),
  category: z.string().optional(),
  description: z.string().trim().optional(),
  totalAmount: paise,
  dueDate: dateStr.optional().nullable(),
});

const paymentSchema = z.object({
  description: z.string().trim().min(1),
  amount: paise,
  paidBy: z.string().uuid(),
  paymentSource: z.enum(['pool', 'personal']),
  date: dateStr,
  category: z.string().optional(),
  participants: z.array(z.string().uuid()).min(1),
  splitMethod: z.enum(['equal', 'custom', 'percentage']),
  splits: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        amount: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  note: z.string().optional(),
});

async function replaceSplits(
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase'],
  transactionId: string,
  splits: { memberId: string; amount: number }[],
) {
  const { error: delErr } = await supabase.from('transaction_splits').delete().eq('transaction_id', transactionId);
  if (delErr) throw delErr;
  const { error: insErr } = await supabase.from('transaction_splits').insert(
    splits.map((s) => ({
      transaction_id: transactionId,
      member_id: s.memberId,
      amount: s.amount,
    })),
  );
  if (insErr) throw insErr;
}

export async function createCommitment(
  potId: string,
  input: z.infer<typeof commitmentFields>,
): Promise<ActionResult<{ commitmentId: string }>> {
  try {
    const parsed = commitmentFields.parse(input);
    const amountCheck = validateCommitmentTotalAmount(parsed.totalAmount);
    if (!amountCheck.valid) return actionFail(amountCheck.error);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canCreateCommitment(me)) return actionFail('You do not have permission to do that');

    const { data, error } = await auth.supabase.rpc('create_commitment', {
      p_pot_id: potId,
      p_title: parsed.title,
      p_vendor_name: parsed.vendorName ?? null,
      p_category: parsed.category ?? null,
      p_description: parsed.description ?? null,
      p_total_amount: parsed.totalAmount,
      p_due_date: parsed.dueDate ?? null,
    });

    if (error) return actionFail(error);
    const commitment = mapCommitment(data as CommitmentRow);

    revalidatePotPaths(potId);
    return actionOk({ commitmentId: commitment.id });
  } catch (err) {
    return actionFail(err);
  }
}

export async function updateCommitment(
  potId: string,
  commitmentId: string,
  input: z.infer<typeof commitmentFields>,
): Promise<ActionResult> {
  try {
    const parsed = commitmentFields.parse(input);
    const amountCheck = validateCommitmentTotalAmount(parsed.totalAmount);
    if (!amountCheck.valid) return actionFail(amountCheck.error);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));

    const { data: existingRow, error: loadErr } = await auth.supabase
      .from('commitments')
      .select('*')
      .eq('id', commitmentId)
      .eq('pot_id', potId)
      .maybeSingle();
    if (loadErr) return actionFail(loadErr);
    if (!existingRow) return actionFail('Upcoming payment not found');

    const existing = mapCommitment(existingRow as CommitmentRow);
    if (!canEditCommitment(me, existing)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase.rpc('update_commitment', {
      p_commitment_id: commitmentId,
      p_title: parsed.title,
      p_vendor_name: parsed.vendorName ?? null,
      p_category: parsed.category ?? null,
      p_description: parsed.description ?? null,
      p_total_amount: parsed.totalAmount,
      p_due_date: parsed.dueDate ?? null,
    });

    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function cancelCommitment(potId: string, commitmentId: string): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canCancelCommitment(me)) return actionFail('You do not have permission to do that');

    const { error } = await auth.supabase.rpc('cancel_commitment', {
      p_commitment_id: commitmentId,
    });
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function addCommitmentPayment(
  potId: string,
  commitmentId: string,
  payment: z.infer<typeof paymentSchema>,
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const parsed = paymentSchema.parse(payment);
    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canAddCommitmentPayment(me)) return actionFail('You do not have permission to do that');

    const { data: commitmentRow, error: cErr } = await auth.supabase
      .from('commitments')
      .select('*')
      .eq('id', commitmentId)
      .eq('pot_id', potId)
      .maybeSingle();
    if (cErr) return actionFail(cErr);
    if (!commitmentRow) return actionFail('Upcoming payment not found');

    const commitment = mapCommitment(commitmentRow as CommitmentRow);
    if (commitment.status === 'cancelled') {
      return actionFail('This upcoming payment has been cancelled');
    }

    const [{ data: paymentRows }, { data: txRows }] = await Promise.all([
      auth.supabase.from('commitment_payments').select('*').eq('commitment_id', commitmentId),
      auth.supabase.from('transactions').select('*').eq('pot_id', potId),
    ]);

    const payments = ((paymentRows ?? []) as CommitmentPaymentRow[]).map((r) => ({
      id: r.id,
      potId: r.pot_id,
      commitmentId: r.commitment_id,
      transactionId: r.transaction_id,
      amount: Number(r.amount),
      createdAt: r.created_at,
    }));
    const transactions = ((txRows ?? []) as TransactionRow[]).map((r) => mapTransaction(r, []));

    const paid = calculateCommitmentPaid(commitmentId, payments, transactions);
    const remaining = Math.max(commitment.totalAmount - paid, 0);
    const amountCheck = validateCommitmentPaymentAmount(remaining, parsed.amount);
    if (!amountCheck.valid) return actionFail(amountCheck.error);

    const type = parsed.paymentSource === 'pool' ? 'pool_expense' : 'member_expense';

    const { data: tx, error: txErr } = await auth.supabase
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
      .select('id')
      .single();

    if (txErr) return actionFail(txErr);

    try {
      await replaceSplits(auth.supabase, tx.id, parsed.splits);

      const { error: linkErr } = await auth.supabase.from('commitment_payments').insert({
        commitment_id: commitmentId,
        pot_id: potId,
        transaction_id: tx.id,
        amount: parsed.amount,
      });
      if (linkErr) throw linkErr;
    } catch (midErr) {
      await auth.supabase.from('transactions').delete().eq('id', tx.id);
      return actionFail(midErr);
    }

    revalidatePotPaths(potId);
    return actionOk({ transactionId: tx.id as string });
  } catch (err) {
    return actionFail(err);
  }
}

export async function createCommitmentWithPayment(
  potId: string,
  input: {
    commitment: z.infer<typeof commitmentFields>;
    payment: z.infer<typeof paymentSchema>;
  },
): Promise<ActionResult<{ commitmentId: string; transactionId: string }>> {
  try {
    const commitmentInput = commitmentFields.parse(input.commitment);
    const paymentInput = paymentSchema.parse(input.payment);

    const totalCheck = validateCommitmentTotalAmount(commitmentInput.totalAmount);
    if (!totalCheck.valid) return actionFail(totalCheck.error);

    const paymentCheck = validateCommitmentPaymentAmount(commitmentInput.totalAmount, paymentInput.amount);
    if (!paymentCheck.valid) return actionFail(paymentCheck.error);

    const auth = await requireUser();
    if (!auth.user) return actionFail(auth.error);

    const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
    if (!canCreateCommitment(me) || !canAddCommitmentPayment(me)) {
      return actionFail('You do not have permission to do that');
    }

    const created = await createCommitment(potId, commitmentInput);
    if (!created.ok) return created;

    const paid = await addCommitmentPayment(potId, created.data.commitmentId, paymentInput);
    if (!paid.ok) {
      return actionFail(paid.error);
    }

    revalidatePotPaths(potId);
    return actionOk({
      commitmentId: created.data.commitmentId,
      transactionId: paid.data.transactionId,
    });
  } catch (err) {
    return actionFail(err);
  }
}
