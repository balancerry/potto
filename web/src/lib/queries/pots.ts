import { cache } from 'react';
import {
  calculatePoolBalance,
  calculateTotalContributions,
  calculateTotalSpent,
} from '@/lib/core/logic/accounting';
import { calculateTotalUpcomingRemaining } from '@/lib/core/logic/commitments';
import { canArchivePot, canEditPot, canInvite } from '@/lib/core/logic/permissions';
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

/** Card-facing lifecycle label. Archived is stored; upcoming is derived from open commitments. */
export type PotDisplayStatus = 'active' | 'upcoming' | 'archived';

export interface PotListPermissions {
  canInvite: boolean;
  canEditPot: boolean;
  canArchive: boolean;
}

export interface PotListItem {
  pot: Pot;
  poolBalance: number;
  contributed: number;
  spent: number;
  upcomingRemaining: number;
  lastActivityAt: string;
  displayStatus: PotDisplayStatus;
  permissions: PotListPermissions;
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

function deriveDisplayStatus(potStatus: Pot['status'], upcomingRemaining: number): PotDisplayStatus {
  if (potStatus === 'archived') return 'archived';
  if (upcomingRemaining > 0) return 'upcoming';
  return 'active';
}

/** Pots where the signed-in user is an active member, with summary figures for the home dashboard. */
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

  const [
    { data: potRows, error: potErr },
    { data: memberRows, error: memberErr },
    { data: txRows, error: txErr },
    { data: commitmentRows, error: commitmentErr },
    { data: paymentRows, error: paymentErr },
  ] = await Promise.all([
    supabase.from('pots').select('*').in('id', potIds).order('created_at', { ascending: false }),
    supabase.from('pot_members').select('*').in('pot_id', potIds),
    supabase.from('transactions').select('id, pot_id, type, amount, date, created_at').in('pot_id', potIds),
    supabase.from('commitments').select('*').in('pot_id', potIds),
    supabase.from('commitment_payments').select('*').in('pot_id', potIds),
  ]);

  if (potErr) throw potErr;
  if (memberErr) throw memberErr;
  if (txErr) throw txErr;
  if (commitmentErr) throw commitmentErr;
  if (paymentErr) throw paymentErr;

  const membersByPot = new Map<string, Member[]>();
  for (const row of (memberRows ?? []) as MemberRow[]) {
    const list = membersByPot.get(row.pot_id!) ?? [];
    list.push(mapMember(row));
    membersByPot.set(row.pot_id!, list);
  }

  const txsByPot = new Map<string, Transaction[]>();
  const lastActivityByPot = new Map<string, string>();
  for (const row of txRows ?? []) {
    const potId = row.pot_id as string;
    const list = txsByPot.get(potId) ?? [];
    const date = (row.date as string) || '';
    const createdAt = (row.created_at as string) || '';
    list.push({
      id: row.id as string,
      potId,
      type: row.type as Transaction['type'],
      description: '',
      amount: Number(row.amount),
      date,
      createdAt,
      createdBy: '',
    });
    txsByPot.set(potId, list);

    const activityAt = createdAt || date;
    if (activityAt) {
      const prev = lastActivityByPot.get(potId);
      if (!prev || activityAt > prev) lastActivityByPot.set(potId, activityAt);
    }
  }

  const commitmentsByPot = new Map<string, Commitment[]>();
  for (const row of (commitmentRows ?? []) as CommitmentRow[]) {
    const list = commitmentsByPot.get(row.pot_id) ?? [];
    list.push(mapCommitment(row));
    commitmentsByPot.set(row.pot_id, list);
  }

  const paymentsByPot = new Map<string, CommitmentPayment[]>();
  for (const row of (paymentRows ?? []) as CommitmentPaymentRow[]) {
    const list = paymentsByPot.get(row.pot_id) ?? [];
    list.push(mapCommitmentPayment(row));
    paymentsByPot.set(row.pot_id, list);
  }

  return ((potRows ?? []) as PotRow[]).map((row) => {
    const members = membersByPot.get(row.id) ?? [];
    const pot = mapPot(row, members);
    const txs = txsByPot.get(row.id) ?? [];
    const commitments = commitmentsByPot.get(row.id) ?? [];
    const payments = paymentsByPot.get(row.id) ?? [];
    const poolBalance = calculatePoolBalance(txs);
    const contributed = calculateTotalContributions(txs);
    const spent = calculateTotalSpent(txs);
    const upcomingRemaining = calculateTotalUpcomingRemaining(commitments, payments, txs);
    const currentMember =
      members.find((m) => m.status === 'active' && m.userId === user.id) ?? undefined;

    return {
      pot,
      poolBalance,
      contributed,
      spent,
      upcomingRemaining,
      lastActivityAt: lastActivityByPot.get(row.id) ?? pot.createdAt,
      displayStatus: deriveDisplayStatus(pot.status, upcomingRemaining),
      permissions: {
        canInvite: canInvite(currentMember),
        canEditPot: canEditPot(currentMember),
        canArchive: canArchivePot(currentMember) && pot.status === 'active',
      },
    };
  });
}

export interface PotShell {
  pot: Pot;
  currentMember: Member | null;
}

/**
 * Lightweight chrome for pot layout (name, nav, admin). Avoids loading the full ledger
 * so tab switches and first paint are not blocked on transactions/splits.
 */
export const getPotShell = cache(async (potId: string): Promise<PotShell | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: potRow, error: potErr }, { data: memberRows, error: memberErr }] = await Promise.all([
    supabase.from('pots').select('*').eq('id', potId).maybeSingle(),
    supabase.from('pot_members').select('*').eq('pot_id', potId).order('created_at', { ascending: true }),
  ]);

  if (potErr) throw potErr;
  if (memberErr) throw memberErr;
  if (!potRow) return null;

  const members = ((memberRows ?? []) as MemberRow[]).map(mapMember);
  const currentMember = members.find((m) => m.status === 'active' && m.userId === user.id) ?? null;
  if (!currentMember) return null;

  return {
    pot: mapPot(potRow as PotRow, members),
    currentMember,
  };
});

/**
 * Full pot payload for detail screens.
 * Returns null if the pot does not exist or the caller is not an active member.
 * Cached per-request so multiple page fetches share one load.
 */
export const getPotBundle = cache(async (potId: string): Promise<PotBundle | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
  const currentMember = members.find((m) => m.status === 'active' && m.userId === user.id) ?? null;
  if (!currentMember) return null;

  const pot = mapPot(potRow as PotRow, members);

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
