import { cache } from 'react';
import { calculatePoolBalance } from '@/lib/core/logic/accounting';
import type {
  Commitment,
  CommitmentPayment,
  JoinRequest,
  Member,
  Pot,
  Transaction,
} from '@/lib/core/models';
import {
  mapCommitment,
  mapCommitmentPayment,
  mapJoinRequest,
  mapMember,
  mapPot,
  mapSplit,
  mapTransaction,
  type CommitmentPaymentRow,
  type CommitmentRow,
  type JoinRequestRow,
  type MemberRow,
  type PotRow,
  type SplitRow,
  type TransactionRow,
} from '@/lib/mappers';
import { createClient } from '@/lib/supabase/server';

export interface PotListItem {
  pot: Pot;
  poolBalance: number;
}

export interface PotBundle {
  pot: Pot;
  members: Member[];
  transactions: Transaction[];
  joinRequests: JoinRequest[];
  commitments: Commitment[];
  commitmentPayments: CommitmentPayment[];
  currentMember: Member | null;
}

/** Pots where the signed-in user is an active member, with pool balance. */
export async function listMyPots(): Promise<PotListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships, error: memErr } = await supabase
    .from('pot_members')
    .select('pot_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (memErr) throw memErr;
  const potIds = [...new Set((memberships ?? []).map((m) => m.pot_id as string))];
  if (potIds.length === 0) return [];

  const [{ data: potRows, error: potErr }, { data: memberRows, error: memberErr }, { data: txRows, error: txErr }] =
    await Promise.all([
      supabase.from('pots').select('*').in('id', potIds).order('created_at', { ascending: false }),
      supabase.from('pot_members').select('*').in('pot_id', potIds),
      supabase.from('transactions').select('id, pot_id, type, amount').in('pot_id', potIds),
    ]);

  if (potErr) throw potErr;
  if (memberErr) throw memberErr;
  if (txErr) throw txErr;

  const membersByPot = new Map<string, Member[]>();
  for (const row of (memberRows ?? []) as MemberRow[]) {
    const list = membersByPot.get(row.pot_id!) ?? [];
    list.push(mapMember(row));
    membersByPot.set(row.pot_id!, list);
  }

  const txsByPot = new Map<string, Transaction[]>();
  for (const row of txRows ?? []) {
    const potId = row.pot_id as string;
    const list = txsByPot.get(potId) ?? [];
    list.push({
      id: row.id as string,
      potId,
      type: row.type as Transaction['type'],
      description: '',
      amount: Number(row.amount),
      date: '',
      createdAt: '',
      createdBy: '',
    });
    txsByPot.set(potId, list);
  }

  return ((potRows ?? []) as PotRow[]).map((row) => {
    const members = membersByPot.get(row.id) ?? [];
    const pot = mapPot(row, members);
    const poolBalance = calculatePoolBalance(txsByPot.get(row.id) ?? []);
    return { pot, poolBalance };
  });
}

/**
 * Full pot payload for detail screens.
 * Returns null if the pot does not exist or the caller is not an active member.
 * Cached per-request so layout + page share one fetch.
 */
export const getPotBundle = cache(async (potId: string): Promise<PotBundle | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myMembership } = await supabase
    .from('pot_members')
    .select('id')
    .eq('pot_id', potId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!myMembership) return null;

  const [
    { data: potRow, error: potErr },
    { data: memberRows, error: memberErr },
    { data: txRows, error: txErr },
    { data: joinRows, error: joinErr },
    { data: commitmentRows, error: commitmentErr },
    { data: paymentRows, error: paymentErr },
  ] = await Promise.all([
    supabase.from('pots').select('*').eq('id', potId).maybeSingle(),
    supabase.from('pot_members').select('*').eq('pot_id', potId).order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('*')
      .eq('pot_id', potId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('join_requests').select('*').eq('pot_id', potId).order('created_at', { ascending: false }),
    supabase.from('commitments').select('*').eq('pot_id', potId).order('created_at', { ascending: false }),
    supabase.from('commitment_payments').select('*').eq('pot_id', potId),
  ]);

  if (potErr) throw potErr;
  if (memberErr) throw memberErr;
  if (txErr) throw txErr;
  if (joinErr) throw joinErr;
  if (commitmentErr) throw commitmentErr;
  if (paymentErr) throw paymentErr;
  if (!potRow) return null;

  const members = ((memberRows ?? []) as MemberRow[]).map(mapMember);
  const pot = mapPot(potRow as PotRow, members);
  const currentMember = members.find((m) => m.status === 'active' && m.userId === user.id) ?? null;

  const txIds = ((txRows ?? []) as TransactionRow[]).map((t) => t.id);
  let splitsByTx = new Map<string, ReturnType<typeof mapSplit>[]>();
  if (txIds.length > 0) {
    const { data: splitRows, error: splitErr } = await supabase
      .from('transaction_splits')
      .select('*')
      .in('transaction_id', txIds);
    if (splitErr) throw splitErr;
    splitsByTx = new Map();
    for (const row of (splitRows ?? []) as SplitRow[]) {
      const tid = row.transaction_id!;
      const list = splitsByTx.get(tid) ?? [];
      list.push(mapSplit(row));
      splitsByTx.set(tid, list);
    }
  }

  const transactions = ((txRows ?? []) as TransactionRow[]).map((row) =>
    mapTransaction(row, splitsByTx.get(row.id) ?? []),
  );

  // Join requests: RLS only returns rows for admins or the requester's own.
  const joinRequests = ((joinRows ?? []) as JoinRequestRow[]).map(mapJoinRequest);
  const commitments = ((commitmentRows ?? []) as CommitmentRow[]).map(mapCommitment);
  const commitmentPayments = ((paymentRows ?? []) as CommitmentPaymentRow[]).map(mapCommitmentPayment);

  return {
    pot,
    members,
    transactions,
    joinRequests,
    commitments,
    commitmentPayments,
    currentMember,
  };
});
