import { supabase } from '@/lib/supabase';

export async function addMoneyRemote(input: {
  potId: string;
  date: string;
  note?: string;
  receivedVia: 'online' | 'cash';
  poolAccountId: string;
  entries: { memberId: string; amount: number }[];
  createdByMemberId: string;
}): Promise<void> {
  const rows = input.entries.map((entry) => ({
    pot_id: input.potId,
    type: 'contribution',
    description: 'Contribution',
    amount: entry.amount,
    date: input.date,
    note: input.note ?? null,
    paid_by: entry.memberId,
    created_by: input.createdByMemberId,
    received_via: input.receivedVia,
    pool_account_id: input.poolAccountId,
    payment_method: input.receivedVia === 'cash' ? 'cash' : 'bank_transfer',
  }));
  const { error } = await supabase.from('transactions').insert(rows);
  if (error) throw error;
}

export async function addExpenseRemote(input: {
  potId: string;
  description: string;
  amount: number;
  paidBy: string;
  paymentSource: 'pool' | 'personal';
  poolAccountId?: string;
  date: string;
  categoryId?: string;
  note?: string;
  participants: string[];
  splitMethod: string;
  splits: { memberId: string; amount: number }[];
  createdByMemberId: string;
}): Promise<void> {
  const type = input.paymentSource === 'pool' ? 'pool_expense' : 'member_expense';
  const { data: tx, error } = await supabase
    .from('transactions')
    .insert({
      pot_id: input.potId,
      type,
      description: input.description,
      amount: input.amount,
      date: input.date,
      note: input.note ?? null,
      category_id: input.categoryId ?? null,
      paid_by: input.paidBy,
      payment_source: input.paymentSource,
      pool_account_id: input.paymentSource === 'pool' ? input.poolAccountId ?? null : null,
      split_method: input.splitMethod,
      participants: input.participants,
      created_by: input.createdByMemberId,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (input.splits.length > 0) {
    const { error: splitErr } = await supabase.from('transaction_splits').insert(
      input.splits.map((s) => ({
        transaction_id: tx.id,
        member_id: s.memberId,
        amount: s.amount,
      })),
    );
    if (splitErr) throw splitErr;
  }
}

export async function recordSettlementRemote(input: {
  potId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  note?: string;
  createdByMemberId: string;
}): Promise<void> {
  const { error } = await supabase.from('transactions').insert({
    pot_id: input.potId,
    type: 'settlement',
    description: 'Settlement',
    amount: input.amount,
    date: input.date,
    note: input.note ?? null,
    paid_by: input.fromMemberId,
    to_member: input.toMemberId,
    payment_method: input.paymentMethod ?? null,
    created_by: input.createdByMemberId,
  });
  if (error) throw error;
}

export async function deleteTransactionRemote(potId: string, txId: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', txId).eq('pot_id', potId);
  if (error) throw error;
}

export async function requestToJoinRemote(input: {
  potId: string;
  requestedName: string;
}): Promise<{ status: 'created' | 'already_pending' | 'already_member'; joinRequestId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to continue');

  const { data: existingMember } = await supabase
    .from('pot_members')
    .select('id')
    .eq('pot_id', input.potId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (existingMember) {
    return { status: 'already_member', joinRequestId: existingMember.id as string };
  }

  const { data: pending } = await supabase
    .from('join_requests')
    .select('id')
    .eq('pot_id', input.potId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (pending) {
    return { status: 'already_pending', joinRequestId: pending.id as string };
  }

  const { data: created, error } = await supabase
    .from('join_requests')
    .insert({
      pot_id: input.potId,
      user_id: user.id,
      requested_name: input.requestedName.trim(),
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { status: 'created', joinRequestId: created.id as string };
}

export async function approveJoinRequestRemote(input: {
  joinRequestId: string;
  targetMemberId: string | null;
  newMemberDisplayName: string | null;
  accessLevel: 'member' | 'view_only';
}): Promise<void> {
  const { error } = await supabase.rpc('approve_join_request', {
    p_join_request_id: input.joinRequestId,
    p_target_member_id: input.targetMemberId,
    p_new_member_display_name: input.newMemberDisplayName,
    p_access_level: input.accessLevel,
  });
  if (error) throw new Error(error.message);
}

export async function rejectJoinRequestRemote(joinRequestId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_join_request', {
    p_join_request_id: joinRequestId,
  });
  if (error) throw new Error(error.message);
}

export async function updatePotMemberRemote(input: {
  memberId: string;
  role?: 'admin' | 'member' | null;
  accessLevel?: 'member' | 'view_only' | null;
  displayName?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('update_pot_member', {
    p_member_id: input.memberId,
    p_role: input.role ?? null,
    p_access_level: input.accessLevel ?? null,
    p_display_name: input.displayName ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function removeMemberRemote(potId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('pot_members')
    .update({ status: 'inactive', user_id: null })
    .eq('id', memberId)
    .eq('pot_id', potId);
  if (error) throw new Error(error.message);
}

async function replaceSplits(
  transactionId: string,
  splits: { memberId: string; amount: number }[],
): Promise<void> {
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

export async function updateContributionRemote(
  potId: string,
  txId: string,
  updates: {
    memberId: string;
    amount: number;
    date: string;
    note?: string;
    receivedVia: 'online' | 'cash';
    poolAccountId: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      paid_by: updates.memberId,
      amount: updates.amount,
      date: updates.date,
      note: updates.note ?? null,
      received_via: updates.receivedVia,
      pool_account_id: updates.poolAccountId,
      payment_method: updates.receivedVia === 'cash' ? 'cash' : 'bank_transfer',
    })
    .eq('id', txId)
    .eq('pot_id', potId)
    .eq('type', 'contribution');
  if (error) throw error;
}

export async function updateExpenseRemote(
  potId: string,
  txId: string,
  updates: {
    description: string;
    amount: number;
    paidBy: string;
    paymentSource: 'pool' | 'personal';
    poolAccountId?: string;
    date: string;
    categoryId?: string;
    note?: string;
    participants: string[];
    splitMethod: string;
    splits: { memberId: string; amount: number }[];
  },
): Promise<void> {
  const type = updates.paymentSource === 'pool' ? 'pool_expense' : 'member_expense';
  const { error } = await supabase
    .from('transactions')
    .update({
      type,
      description: updates.description,
      amount: updates.amount,
      date: updates.date,
      paid_by: updates.paidBy,
      payment_source: updates.paymentSource,
      pool_account_id: updates.paymentSource === 'pool' ? updates.poolAccountId ?? null : null,
      category_id: updates.categoryId ?? null,
      participants: updates.participants,
      split_method: updates.splitMethod,
      note: updates.note ?? null,
    })
    .eq('id', txId)
    .eq('pot_id', potId);
  if (error) throw error;
  await replaceSplits(txId, updates.splits);
}

export async function updateSettlementRemote(
  potId: string,
  txId: string,
  updates: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    date: string;
    paymentMethod?: string;
    note?: string;
    description: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      description: updates.description,
      amount: updates.amount,
      date: updates.date,
      paid_by: updates.fromMemberId,
      to_member: updates.toMemberId,
      payment_method: updates.paymentMethod ?? null,
      note: updates.note ?? null,
    })
    .eq('id', txId)
    .eq('pot_id', potId)
    .eq('type', 'settlement');
  if (error) throw error;
}

export async function createCommitmentRemote(input: {
  potId: string;
  title: string;
  vendorName?: string;
  categoryId?: string;
  description?: string;
  totalAmount: number;
  dueDate?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_commitment', {
    p_pot_id: input.potId,
    p_title: input.title,
    p_vendor_name: input.vendorName ?? null,
    p_category_id: input.categoryId ?? null,
    p_description: input.description ?? null,
    p_total_amount: input.totalAmount,
    p_due_date: input.dueDate ?? null,
  });
  if (error) throw new Error(error.message);
  const row = data as { id?: string } | null;
  if (!row?.id) throw new Error('Failed to create planned payment');
  return row.id;
}

export async function updateCommitmentRemote(
  commitmentId: string,
  input: {
    title: string;
    vendorName?: string;
    categoryId?: string;
    description?: string;
    totalAmount: number;
    dueDate?: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc('update_commitment', {
    p_commitment_id: commitmentId,
    p_title: input.title,
    p_vendor_name: input.vendorName ?? null,
    p_category_id: input.categoryId ?? null,
    p_description: input.description ?? null,
    p_total_amount: input.totalAmount,
    p_due_date: input.dueDate ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function cancelCommitmentRemote(commitmentId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_commitment', {
    p_commitment_id: commitmentId,
  });
  if (error) throw new Error(error.message);
}

export async function transferPoolMoneyRemote(input: {
  potId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('create_pool_transfer', {
    p_pot_id: input.potId,
    p_from_account_id: input.fromAccountId,
    p_to_account_id: input.toAccountId,
    p_amount: input.amount,
    p_date: input.date,
    p_note: input.note ?? null,
  });
  if (error) throw error;
}

export async function assignPoolManagerRemote(potId: string, memberId: string): Promise<void> {
  const { error } = await supabase.rpc('assign_pool_manager', {
    p_pot_id: potId,
    p_member_id: memberId,
  });
  if (error) throw error;
}

export async function addCommitmentPaymentRemote(input: {
  potId: string;
  commitmentId: string;
  description: string;
  amount: number;
  paidBy: string;
  paymentSource: 'pool' | 'personal';
  poolAccountId?: string;
  date: string;
  categoryId?: string;
  note?: string;
  participants: string[];
  splitMethod: string;
  splits: { memberId: string; amount: number }[];
  createdByMemberId: string;
}): Promise<string> {
  const type = input.paymentSource === 'pool' ? 'pool_expense' : 'member_expense';
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .insert({
      pot_id: input.potId,
      type,
      description: input.description,
      amount: input.amount,
      date: input.date,
      note: input.note ?? null,
      category_id: input.categoryId ?? null,
      paid_by: input.paidBy,
      payment_source: input.paymentSource,
      pool_account_id: input.paymentSource === 'pool' ? input.poolAccountId ?? null : null,
      split_method: input.splitMethod,
      participants: input.participants,
      created_by: input.createdByMemberId,
    })
    .select('id')
    .single();
  if (txErr) throw txErr;

  try {
    await replaceSplits(tx.id, input.splits);
    const { error: linkErr } = await supabase.from('commitment_payments').insert({
      commitment_id: input.commitmentId,
      pot_id: input.potId,
      transaction_id: tx.id,
      amount: input.amount,
    });
    if (linkErr) throw linkErr;
  } catch (err) {
    await supabase.from('transactions').delete().eq('id', tx.id);
    throw err;
  }

  return tx.id as string;
}

export async function updatePotDetailsRemote(
  potId: string,
  updates: { name?: string; description?: string; expectedContributionPerMember?: number | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) {
    patch.description = updates.description === '' ? null : updates.description;
  }
  if (updates.expectedContributionPerMember !== undefined) {
    patch.expected_contribution_per_member = updates.expectedContributionPerMember;
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('pots').update(patch).eq('id', potId);
  if (error) throw error;
}

export async function setInviteEnabledRemote(potId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('pots').update({ invite_enabled: enabled }).eq('id', potId);
  if (error) throw error;
}

export async function setJoinEnabledRemote(potId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('pots').update({ join_enabled: enabled }).eq('id', potId);
  if (error) throw error;
}

export async function regenerateInviteCodeRemote(inviteCode: string, potId: string): Promise<void> {
  const { error } = await supabase.from('pots').update({ invite_code: inviteCode }).eq('id', potId);
  if (error) throw error;
}

export async function regenerateJoinCodeRemote(joinCode: string, potId: string): Promise<void> {
  const { error } = await supabase.from('pots').update({ join_code: joinCode }).eq('id', potId);
  if (error) throw error;
}

export async function listInviteCodesRemote(): Promise<string[]> {
  const { data, error } = await supabase.from('pots').select('invite_code');
  if (error) throw error;
  return (data ?? []).map((r) => r.invite_code as string);
}

export async function listJoinCodesRemote(): Promise<string[]> {
  const { data, error } = await supabase.from('pots').select('join_code');
  if (error) throw error;
  return (data ?? []).map((r) => r.join_code as string);
}

// ---------------------------------------------------------------------------
// Pot categories. Authorization and integrity live in the database RPCs; the
// store checks permissions first only to fail fast with a friendlier message.
// ---------------------------------------------------------------------------

type CategoryRow = {
  id: string;
  pot_id: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
};

export async function createCategoryRemote(input: {
  potId: string;
  name: string;
  icon: string;
  color: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_pot_category', {
    p_pot_id: input.potId,
    p_name: input.name,
    p_icon: input.icon,
    p_color: input.color,
  });
  if (error) throw new Error(error.message);
  return (data as CategoryRow).id;
}

export async function updateCategoryRemote(
  categoryId: string,
  input: { name: string; icon: string; color: string },
): Promise<void> {
  const { error } = await supabase.rpc('update_pot_category', {
    p_category_id: categoryId,
    p_name: input.name,
    p_icon: input.icon,
    p_color: input.color,
  });
  if (error) throw new Error(error.message);
}

export async function setCategoryActiveRemote(categoryId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_pot_category_active', {
    p_category_id: categoryId,
    p_active: active,
  });
  if (error) throw new Error(error.message);
}

export async function reorderCategoriesRemote(potId: string, categoryIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_pot_categories', {
    p_pot_id: potId,
    p_category_ids: categoryIds,
  });
  if (error) throw new Error(error.message);
}
