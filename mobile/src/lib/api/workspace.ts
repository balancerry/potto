import { supabase } from '@/lib/supabase';
import type {
  Commitment,
  CommitmentPayment,
  JoinRequest,
  Member,
  Pot,
  PottoUser,
  Transaction,
} from '@/types/models';

export type WorkspaceSnapshot = {
  currentUser: PottoUser;
  currentUserName: string;
  pots: Record<string, Pot>;
  transactions: Record<string, Transaction[]>;
  joinRequests: Record<string, JoinRequest[]>;
  commitments: Record<string, Commitment[]>;
  commitmentPayments: Record<string, CommitmentPayment[]>;
};

function emptyWorkspace(user: PottoUser): WorkspaceSnapshot {
  return {
    currentUser: user,
    currentUserName: user.name,
    pots: {},
    transactions: {},
    joinRequests: {},
    commitments: {},
    commitmentPayments: {},
  };
}

/** Load all pots the signed-in user belongs to — same Supabase data as Web. */
export async function fetchWorkspace(userId: string, displayName: string): Promise<WorkspaceSnapshot> {
  const currentUser: PottoUser = { id: userId, name: displayName };
  const base = emptyWorkspace(currentUser);

  const { data: memberships, error: memErr } = await supabase
    .from('pot_members')
    .select('pot_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (memErr) throw memErr;

  const potIds = [...new Set((memberships ?? []).map((m) => m.pot_id as string))];
  if (potIds.length === 0) return base;

  const [
    { data: potRows, error: potErr },
    { data: memberRows, error: memberErr },
    { data: txRows, error: txErr },
    { data: joinRows, error: joinErr },
    { data: commitmentRows, error: commitmentErr },
    { data: paymentRows, error: paymentErr },
  ] = await Promise.all([
    supabase.from('pots').select('*').in('id', potIds).order('created_at', { ascending: false }),
    supabase.from('pot_members').select('*').in('pot_id', potIds),
    supabase.from('transactions').select('*').in('pot_id', potIds),
    supabase.from('join_requests').select('*').in('pot_id', potIds),
    supabase.from('commitments').select('*').in('pot_id', potIds),
    supabase.from('commitment_payments').select('*').in('pot_id', potIds),
  ]);

  if (potErr) throw potErr;
  if (memberErr) throw memberErr;
  if (txErr) throw txErr;
  if (joinErr) throw joinErr;
  if (commitmentErr) throw commitmentErr;
  if (paymentErr) throw paymentErr;

  const membersByPot = new Map<string, Member[]>();
  for (const row of memberRows ?? []) {
    const potId = row.pot_id as string;
    const list = membersByPot.get(potId) ?? [];
    list.push({
      id: row.id,
      name: row.display_name,
      role: row.role,
      accessLevel: row.access_level,
      status: row.status,
      userId: row.user_id,
      joinedAt: row.created_at,
    });
    membersByPot.set(potId, list);
  }

  const txIds = (txRows ?? []).map((t) => t.id as string);
  const splitsByTx = new Map<string, { memberId: string; amount: number }[]>();
  if (txIds.length > 0) {
    const { data: splitRows, error: splitErr } = await supabase
      .from('transaction_splits')
      .select('*')
      .in('transaction_id', txIds);
    if (splitErr) throw splitErr;
    for (const row of splitRows ?? []) {
      const tid = row.transaction_id as string;
      const list = splitsByTx.get(tid) ?? [];
      list.push({ memberId: row.member_id, amount: Number(row.amount) });
      splitsByTx.set(tid, list);
    }
  }

  const pots: Record<string, Pot> = {};
  for (const row of potRows ?? []) {
    const members = membersByPot.get(row.id) ?? [];
    const creatorMember =
      members.find((m) => m.role === 'admin') ??
      members.find((m) => m.userId === row.created_by) ??
      members[0];
    pots[row.id] = {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      currency: row.currency,
      createdBy: creatorMember?.id ?? row.created_by,
      inviteCode: row.invite_code,
      inviteEnabled: row.invite_enabled,
      joinCode: row.join_code,
      joinEnabled: row.join_enabled,
      expectedContributionPerMember: row.expected_contribution_per_member,
      status: row.status,
      createdAt: row.created_at,
      members,
    };
  }

  const transactions: Record<string, Transaction[]> = {};
  for (const row of txRows ?? []) {
    const potId = row.pot_id as string;
    const splits = splitsByTx.get(row.id) ?? [];
    const tx: Transaction = {
      id: row.id,
      potId,
      type: row.type,
      description: row.description,
      amount: Number(row.amount),
      date: String(row.date).slice(0, 10),
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
    if (row.note) tx.note = row.note;
    if (row.category) tx.category = row.category;
    if (row.paid_by) tx.paidBy = row.paid_by;
    if (row.to_member) tx.toMember = row.to_member;
    if (row.payment_method) tx.paymentMethod = row.payment_method;
    if (row.payment_source) tx.paymentSource = row.payment_source;
    if (row.split_method) tx.splitMethod = row.split_method;
    if (row.participants?.length) tx.participants = row.participants;
    if (splits.length) tx.splits = splits;
    const list = transactions[potId] ?? [];
    list.push(tx);
    transactions[potId] = list;
  }

  const joinRequests: Record<string, JoinRequest[]> = {};
  for (const row of joinRows ?? []) {
    const potId = row.pot_id as string;
    const list = joinRequests[potId] ?? [];
    list.push({
      id: row.id,
      potId,
      userId: row.user_id,
      requestedName: row.requested_name,
      status: row.status,
      linkedMemberId: row.linked_member_id,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    });
    joinRequests[potId] = list;
  }

  const commitments: Record<string, Commitment[]> = {};
  for (const row of commitmentRows ?? []) {
    const potId = row.pot_id as string;
    const list = commitments[potId] ?? [];
    list.push({
      id: row.id,
      potId,
      title: row.title,
      vendorName: row.vendor_name ?? undefined,
      category: row.category ?? undefined,
      description: row.description ?? undefined,
      totalAmount: Number(row.total_amount),
      dueDate: row.due_date ? String(row.due_date).slice(0, 10) : undefined,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    commitments[potId] = list;
  }

  const commitmentPayments: Record<string, CommitmentPayment[]> = {};
  for (const row of paymentRows ?? []) {
    const potId = row.pot_id as string;
    const list = commitmentPayments[potId] ?? [];
    list.push({
      id: row.id,
      potId,
      commitmentId: row.commitment_id,
      transactionId: row.transaction_id,
      amount: Number(row.amount),
      createdAt: row.created_at,
    });
    commitmentPayments[potId] = list;
  }

  return {
    currentUser,
    currentUserName: displayName,
    pots,
    transactions,
    joinRequests,
    commitments,
    commitmentPayments,
  };
}

export async function createPotRemote(input: {
  name: string;
  description?: string;
  memberNames: string[];
  startingContributionPaise?: number;
  expectedContributionPaise?: number;
}): Promise<string> {
  const { data: potId, error } = await supabase.rpc('create_pot', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_member_names: input.memberNames.filter((n) => n.trim().length > 0),
    p_starting_contribution: input.startingContributionPaise ?? null,
    p_expected_contribution_per_member: input.expectedContributionPaise ?? null,
  });
  if (error) throw error;
  if (!potId || typeof potId !== 'string') throw new Error('Failed to create pot');
  return potId;
}

export async function deletePotRemote(potId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_pot', { p_pot_id: potId });
  if (error) throw error;
}

export async function archivePotRemote(potId: string): Promise<void> {
  const { error } = await supabase.from('pots').update({ status: 'archived' }).eq('id', potId);
  if (error) throw error;
}
