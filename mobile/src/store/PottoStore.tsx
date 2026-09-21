import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { calculateExpenseShares } from '@/logic/accounting';
import { calculateCommitmentPaid, validateCommitmentPaymentAmount, validateCommitmentTotalAmount } from '@/logic/commitments';
import { generateInviteCode, generateJoinCode } from '@/logic/invites';
import * as JoinFlow from '@/logic/join-requests';
import {
  canAddCommitmentPayment,
  canAddExpense,
  canAddMoney,
  canArchivePot,
  canCancelCommitment,
  canCreateCommitment,
  canDeleteTransaction,
  canEditCommitment,
  canEditPot,
  canEditTransaction,
  canManageMembers,
  canReviewJoinRequests,
  canSettle,
} from '@/logic/permissions';
import { archivePotRemote, createPotRemote, deletePotRemote, fetchWorkspace } from '@/lib/api/workspace';
import {
  addCommitmentPaymentRemote,
  addExpenseRemote,
  addMoneyRemote,
  approveJoinRequestRemote,
  cancelCommitmentRemote,
  createCommitmentRemote,
  deleteTransactionRemote,
  listInviteCodesRemote,
  listJoinCodesRemote,
  recordSettlementRemote,
  regenerateInviteCodeRemote,
  regenerateJoinCodeRemote,
  rejectJoinRequestRemote,
  removeMemberRemote,
  requestToJoinRemote,
  setInviteEnabledRemote,
  setJoinEnabledRemote,
  updateCommitmentRemote,
  updateContributionRemote,
  updateExpenseRemote,
  updatePotDetailsRemote,
  updatePotMemberRemote,
  updateSettlementRemote,
} from '@/lib/api/mutations';
import type {
  AccessLevel,
  Commitment,
  CommitmentPayment,
  JoinRequest,
  Member,
  PaymentMethod,
  Pot,
  PottoUser,
  Split,
  SplitMethod,
  Transaction,
} from '@/types/models';

interface PottoState {
  currentUser: PottoUser;
  currentUserName: string;
  pots: Record<string, Pot>;
  transactions: Record<string, Transaction[]>;
  joinRequests: Record<string, JoinRequest[]>;
  commitments: Record<string, Commitment[]>;
  commitmentPayments: Record<string, CommitmentPayment[]>;
  /** True while first remote hydrate is in flight. */
  syncing: boolean;
  /** True after a successful remote hydrate (or explicit clear). */
  ready: boolean;
}

const EMPTY_USER: PottoUser = { id: '', name: '' };

function emptyState(): PottoState {
  return {
    currentUser: EMPTY_USER,
    currentUserName: '',
    pots: {},
    transactions: {},
    joinRequests: {},
    commitments: {},
    commitmentPayments: {},
    syncing: false,
    ready: false,
  };
}

/**
 * Resolves the acting member for the current device identity within a Pot.
 * Prefers the linked account (`userId`); falls back to a name match so
 * pre-existing/seeded members that haven't been explicitly linked yet still
 * resolve to "me" the same way `getCurrentMember` always has.
 */
function resolveCurrentMember(pot: Pot | undefined, currentUser: PottoUser): Member | undefined {
  if (!pot) return undefined;
  return (
    pot.members.find((m) => m.status === 'active' && m.userId === currentUser.id) ??
    pot.members.find((m) => m.status === 'active' && m.name === currentUser.name)
  );
}

export interface CreatePotInput {
  name: string;
  description?: string;
  startingContribution?: number; // paise
  /** Optional per-member target contribution (paise); see Pot.expectedContributionPerMember. */
  expectedContributionPerMember?: number;
  memberNames: string[]; // additional members besides the creator
}

export interface ContributionEntry {
  memberId: string;
  amount: number; // paise
}

export interface AddMoneyInput {
  potId: string;
  date: string;
  note?: string;
  entries: ContributionEntry[];
}

export interface UpdateContributionInput {
  memberId: string;
  amount: number; // paise
  date: string;
  note?: string;
}

export interface AddExpenseInput {
  potId: string;
  description: string;
  amount: number; // paise
  paidBy: string; // memberId
  paymentSource: 'pool' | 'personal';
  date: string;
  category?: string;
  participants: string[];
  splitMethod: SplitMethod;
  splits: Split[];
  note?: string;
}

export type UpdateExpenseInput = Omit<AddExpenseInput, 'potId'>;

export interface RecordSettlementInput {
  potId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number; // paise, the actual amount paid (may be a partial payment)
  date?: string;
  paymentMethod?: PaymentMethod;
  note?: string;
}

export interface UpdateSettlementInput {
  fromMemberId: string;
  toMemberId: string;
  amount: number; // paise
  date: string;
  paymentMethod?: PaymentMethod;
  note?: string;
}

// ---------------------------------------------------------------------
// Commitments ("Upcoming Payments") — see src/logic/commitments.ts and
// src/mvp/Potto_Upcoming_Payments_Commitments_Spec.md.
// ---------------------------------------------------------------------

export interface CreateCommitmentInput {
  potId: string;
  title: string;
  vendorName?: string;
  category?: string;
  description?: string;
  totalAmount: number; // paise
  dueDate?: string; // ISO date, optional
}
export type UpdateCommitmentInput = Omit<CreateCommitmentInput, 'potId'>;

export type CreateCommitmentResult = { ok: true; commitmentId: string } | { ok: false; reason: string };
export type CommitmentActionResult = { ok: true } | { ok: false; reason: string };

/** The expense-shaped part of adding a payment — identical fields to AddExpenseInput minus potId, since a Commitment payment IS a normal expense transaction. */
export interface CommitmentPaymentInput {
  description: string;
  amount: number; // paise
  paidBy: string; // memberId
  paymentSource: 'pool' | 'personal';
  date: string;
  category?: string;
  participants: string[];
  splitMethod: SplitMethod;
  splits: Split[];
  note?: string;
}

export interface AddCommitmentPaymentInput extends CommitmentPaymentInput {
  potId: string;
  commitmentId: string;
}
export type AddCommitmentPaymentResult = { ok: true; transactionId: string } | { ok: false; reason: string };

export interface CreateCommitmentWithPaymentInput {
  potId: string;
  commitment: Omit<CreateCommitmentInput, 'potId'>;
  payment: CommitmentPaymentInput;
}
export type CreateCommitmentWithPaymentResult =
  | { ok: true; commitmentId: string; transactionId: string }
  | { ok: false; reason: string };

export interface RequestToJoinInput {
  potId: string;
  requestedName: string;
  /** Which entry point the requester came through. Defaults to the existing invite-link behavior. */
  channel?: JoinFlow.JoinChannel;
}
export type RequestToJoinResult = JoinFlow.CreateJoinRequestResult | { ok: false; reason: 'pot_not_found' };

export interface ApproveExistingMemberInput {
  potId: string;
  joinRequestId: string;
  memberId: string;
  displayName: string;
  accessLevel: AccessLevel;
}
export interface ApproveNewMemberInput {
  potId: string;
  joinRequestId: string;
  displayName: string;
  accessLevel: AccessLevel;
}
export type ApproveJoinRequestResult =
  | JoinFlow.ApproveResult
  | { ok: false; reason: 'pot_not_found' | 'not_authorized' };

export interface RejectJoinRequestInput {
  potId: string;
  joinRequestId: string;
}
export type RejectJoinRequestResult =
  | JoinFlow.RejectResult
  | { ok: false; reason: 'pot_not_found' | 'not_authorized' };

interface PottoContextValue {
  state: PottoState;
  getPot: (potId: string) => Pot | undefined;
  getTransactions: (potId: string) => Transaction[];
  getCurrentMember: (potId: string) => Member | undefined;
  getJoinRequests: (potId: string) => JoinRequest[];
  getJoinRequest: (potId: string, joinRequestId: string) => JoinRequest | undefined;
  getCommitments: (potId: string) => Commitment[];
  getCommitment: (potId: string, commitmentId: string) => Commitment | undefined;
  getCommitmentPayments: (potId: string, commitmentId: string) => CommitmentPayment[];
  hydrateWorkspace: (userId: string, displayName: string) => Promise<void>;
  reloadWorkspace: () => Promise<void>;
  clearWorkspace: () => void;
  createPot: (input: CreatePotInput) => Promise<string>;
  deletePot: (potId: string) => Promise<void>;
  addMoney: (input: AddMoneyInput) => Promise<void>;
  addExpense: (input: AddExpenseInput) => Promise<void>;
  recordSettlement: (input: RecordSettlementInput) => Promise<void>;
  updateContribution: (potId: string, txId: string, updates: UpdateContributionInput) => Promise<void>;
  updateExpense: (potId: string, txId: string, updates: UpdateExpenseInput) => Promise<void>;
  updateSettlement: (potId: string, txId: string, updates: UpdateSettlementInput) => Promise<void>;
  deleteTransaction: (potId: string, txId: string) => Promise<void>;
  createCommitment: (input: CreateCommitmentInput) => Promise<CreateCommitmentResult>;
  updateCommitment: (potId: string, commitmentId: string, updates: UpdateCommitmentInput) => Promise<CommitmentActionResult>;
  cancelCommitment: (potId: string, commitmentId: string) => Promise<CommitmentActionResult>;
  addCommitmentPayment: (input: AddCommitmentPaymentInput) => Promise<AddCommitmentPaymentResult>;
  createCommitmentWithPayment: (input: CreateCommitmentWithPaymentInput) => Promise<CreateCommitmentWithPaymentResult>;
  requestToJoin: (input: RequestToJoinInput) => Promise<RequestToJoinResult>;
  approveExistingMember: (input: ApproveExistingMemberInput) => Promise<ApproveJoinRequestResult>;
  approveNewMember: (input: ApproveNewMemberInput) => Promise<ApproveJoinRequestResult>;
  rejectJoinRequest: (input: RejectJoinRequestInput) => Promise<RejectJoinRequestResult>;
  removeMember: (potId: string, memberId: string) => Promise<{ ok: boolean; reason?: string }>;
  updateMember: (input: {
    potId: string;
    memberId: string;
    role?: 'admin' | 'member';
    accessLevel?: AccessLevel;
    displayName?: string;
  }) => Promise<{ ok: boolean; reason?: string }>;
  setInviteEnabled: (potId: string, enabled: boolean) => Promise<void>;
  regenerateInviteCode: (potId: string) => Promise<string | undefined>;
  setJoinEnabled: (potId: string, enabled: boolean) => Promise<void>;
  regenerateJoinCode: (potId: string) => Promise<string | undefined>;
  updatePotDetails: (
    potId: string,
    updates: { name?: string; description?: string; expectedContributionPerMember?: number | null },
  ) => Promise<void>;
  archivePot: (potId: string) => Promise<void>;
}

const PottoContext = createContext<PottoContextValue | null>(null);

export function PottoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PottoState>(emptyState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const getPot = useCallback((potId: string) => state.pots[potId], [state.pots]);
  const getTransactions = useCallback((potId: string) => state.transactions[potId] ?? [], [state.transactions]);
  const getCurrentMember = useCallback(
    (potId: string) => resolveCurrentMember(state.pots[potId], state.currentUser),
    [state.pots, state.currentUser],
  );
  const getJoinRequests = useCallback((potId: string) => state.joinRequests[potId] ?? [], [state.joinRequests]);
  const getJoinRequest = useCallback(
    (potId: string, joinRequestId: string) => (state.joinRequests[potId] ?? []).find((r) => r.id === joinRequestId),
    [state.joinRequests],
  );
  const getCommitments = useCallback((potId: string) => state.commitments[potId] ?? [], [state.commitments]);
  const getCommitment = useCallback(
    (potId: string, commitmentId: string) => (state.commitments[potId] ?? []).find((c) => c.id === commitmentId),
    [state.commitments],
  );
  const getCommitmentPayments = useCallback(
    (potId: string, commitmentId: string) =>
      (state.commitmentPayments[potId] ?? []).filter((p) => p.commitmentId === commitmentId),
    [state.commitmentPayments],
  );

  const clearWorkspace = useCallback(() => {
    setState(emptyState());
  }, []);

  const hydrateWorkspace = useCallback(async (userId: string, displayName: string) => {
    setState((prev) => ({ ...prev, syncing: true }));
    try {
      const snap = await fetchWorkspace(userId, displayName);
      setState({
        ...snap,
        syncing: false,
        ready: true,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, syncing: false, ready: true }));
      throw err;
    }
  }, []);

  const reloadWorkspace = useCallback(async () => {
    const { currentUser, currentUserName } = stateRef.current;
    if (!currentUser.id) return;
    const snap = await fetchWorkspace(currentUser.id, currentUser.name || currentUserName);
    setState({
      ...snap,
      syncing: false,
      ready: true,
    });
  }, []);

  const createPot = useCallback(
    async (input: CreatePotInput) => {
      const potId = await createPotRemote({
        name: input.name,
        description: input.description,
        memberNames: input.memberNames,
        startingContributionPaise: input.startingContribution,
        expectedContributionPaise: input.expectedContributionPerMember,
      });
      await reloadWorkspace();
      return potId;
    },
    [reloadWorkspace],
  );

  const deletePot = useCallback(
    async (potId: string) => {
      await deletePotRemote(potId);
      setState((prev) => {
        const pots = { ...prev.pots };
        delete pots[potId];
        const transactions = { ...prev.transactions };
        delete transactions[potId];
        const joinRequests = { ...prev.joinRequests };
        delete joinRequests[potId];
        const commitments = { ...prev.commitments };
        delete commitments[potId];
        const commitmentPayments = { ...prev.commitmentPayments };
        delete commitmentPayments[potId];
        return { ...prev, pots, transactions, joinRequests, commitments, commitmentPayments };
      });
    },
    [],
  );

  const addMoney = useCallback(
    async (input: AddMoneyInput) => {
      const pot = state.pots[input.potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, state.currentUser);
      if (!canAddMoney(me) || !me) throw new Error('Not authorized');
      await addMoneyRemote({
        potId: input.potId,
        date: input.date,
        note: input.note,
        entries: input.entries,
        createdByMemberId: me.id,
      });
      await reloadWorkspace();
    },
    [state.pots, state.currentUser, reloadWorkspace],
  );

  const addExpense = useCallback(
    async (input: AddExpenseInput) => {
      const pot = state.pots[input.potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, state.currentUser);
      if (!canAddExpense(me) || !me) throw new Error('Not authorized');
      await addExpenseRemote({
        potId: input.potId,
        description: input.description,
        amount: input.amount,
        paidBy: input.paidBy,
        paymentSource: input.paymentSource,
        date: input.date,
        category: input.category,
        note: input.note,
        participants: input.participants,
        splitMethod: input.splitMethod,
        splits: input.splits,
        createdByMemberId: me.id,
      });
      await reloadWorkspace();
    },
    [state.pots, state.currentUser, reloadWorkspace],
  );

  const recordSettlement = useCallback(
    async (input: RecordSettlementInput) => {
      const pot = state.pots[input.potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, state.currentUser);
      if (!canSettle(me) || !me) throw new Error('Not authorized');
      if (input.fromMemberId === input.toMemberId) throw new Error('Invalid settlement');
      if (input.amount <= 0) throw new Error('Enter an amount');
      await recordSettlementRemote({
        potId: input.potId,
        fromMemberId: input.fromMemberId,
        toMemberId: input.toMemberId,
        amount: input.amount,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        paymentMethod: input.paymentMethod,
        note: input.note,
        createdByMemberId: me.id,
      });
      await reloadWorkspace();
    },
    [state.pots, state.currentUser, reloadWorkspace],
  );

  const updateContribution = useCallback(
    async (potId: string, txId: string, updates: UpdateContributionInput) => {
      const pot = stateRef.current.pots[potId];
      const existing = stateRef.current.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) throw new Error('Contribution not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditTransaction(me, tx)) throw new Error('Not authorized');
      await updateContributionRemote(potId, txId, updates);
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const updateExpense = useCallback(
    async (potId: string, txId: string, updates: UpdateExpenseInput) => {
      const pot = stateRef.current.pots[potId];
      const existing = stateRef.current.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) throw new Error('Expense not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditTransaction(me, tx)) throw new Error('Not authorized');
      await updateExpenseRemote(potId, txId, updates);
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const updateSettlement = useCallback(
    async (potId: string, txId: string, updates: UpdateSettlementInput) => {
      const pot = stateRef.current.pots[potId];
      const existing = stateRef.current.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) throw new Error('Settlement not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditTransaction(me, tx)) throw new Error('Not authorized');
      if (updates.fromMemberId === updates.toMemberId) throw new Error('Invalid settlement');
      if (updates.amount <= 0) throw new Error('Enter an amount');
      const memberIds = new Set(pot.members.map((m) => m.id));
      if (!memberIds.has(updates.fromMemberId) || !memberIds.has(updates.toMemberId)) {
        throw new Error('Both members must belong to this pot');
      }
      const fromName = pot.members.find((m) => m.id === updates.fromMemberId)?.name ?? '';
      const toName = pot.members.find((m) => m.id === updates.toMemberId)?.name ?? '';
      await updateSettlementRemote(potId, txId, {
        ...updates,
        description: `${fromName} → ${toName}`,
      });
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const deleteTransaction = useCallback(
    async (potId: string, txId: string) => {
      const pot = stateRef.current.pots[potId];
      const existing = stateRef.current.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) throw new Error('Transaction not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canDeleteTransaction(me, tx)) throw new Error('Not authorized');
      await deleteTransactionRemote(potId, txId);
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const createCommitment = useCallback(
    async (input: CreateCommitmentInput): Promise<CreateCommitmentResult> => {
      const pot = stateRef.current.pots[input.potId];
      if (!pot) return { ok: false, reason: 'Pot not found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canCreateCommitment(me) || !me) return { ok: false, reason: 'Not authorized' };
      if (!input.title.trim()) return { ok: false, reason: 'Enter a title' };
      const amountCheck = validateCommitmentTotalAmount(input.totalAmount);
      if (!amountCheck.valid) return { ok: false, reason: amountCheck.error! };
      try {
        const commitmentId = await createCommitmentRemote({
          potId: input.potId,
          title: input.title.trim(),
          vendorName: input.vendorName?.trim() || undefined,
          category: input.category,
          description: input.description?.trim() || undefined,
          totalAmount: input.totalAmount,
          dueDate: input.dueDate,
        });
        await reloadWorkspace();
        return { ok: true, commitmentId };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : 'Could not create' };
      }
    },
    [reloadWorkspace],
  );

  const updateCommitment = useCallback(
    async (
      potId: string,
      commitmentId: string,
      updates: UpdateCommitmentInput,
    ): Promise<CommitmentActionResult> => {
      const pot = stateRef.current.pots[potId];
      const commitment = (stateRef.current.commitments[potId] ?? []).find((c) => c.id === commitmentId);
      if (!pot || !commitment) return { ok: false, reason: 'Upcoming payment not found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditCommitment(me, commitment)) return { ok: false, reason: 'Not authorized' };
      if (!updates.title.trim()) return { ok: false, reason: 'Enter a title' };
      const amountCheck = validateCommitmentTotalAmount(updates.totalAmount);
      if (!amountCheck.valid) return { ok: false, reason: amountCheck.error! };
      try {
        await updateCommitmentRemote(commitmentId, {
          title: updates.title.trim(),
          vendorName: updates.vendorName?.trim() || undefined,
          category: updates.category,
          description: updates.description?.trim() || undefined,
          totalAmount: updates.totalAmount,
          dueDate: updates.dueDate,
        });
        await reloadWorkspace();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : 'Could not update' };
      }
    },
    [reloadWorkspace],
  );

  const cancelCommitment = useCallback(
    async (potId: string, commitmentId: string): Promise<CommitmentActionResult> => {
      const pot = stateRef.current.pots[potId];
      const commitment = (stateRef.current.commitments[potId] ?? []).find((c) => c.id === commitmentId);
      if (!pot || !commitment) return { ok: false, reason: 'Upcoming payment not found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canCancelCommitment(me)) return { ok: false, reason: 'Not authorized' };
      try {
        await cancelCommitmentRemote(commitmentId);
        await reloadWorkspace();
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : 'Could not cancel' };
      }
    },
    [reloadWorkspace],
  );

  const addCommitmentPayment = useCallback(
    async (input: AddCommitmentPaymentInput): Promise<AddCommitmentPaymentResult> => {
      const pot = stateRef.current.pots[input.potId];
      if (!pot) return { ok: false, reason: 'Pot not found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canAddCommitmentPayment(me) || !me) return { ok: false, reason: 'Not authorized' };
      const commitment = (stateRef.current.commitments[input.potId] ?? []).find((c) => c.id === input.commitmentId);
      if (!commitment) return { ok: false, reason: 'Upcoming payment not found' };
      if (commitment.potId !== input.potId) {
        return { ok: false, reason: 'This Upcoming Payment does not belong to this Pot' };
      }
      if (commitment.status === 'cancelled') {
        return { ok: false, reason: 'This Upcoming Payment has been cancelled' };
      }
      const txs = stateRef.current.transactions[input.potId] ?? [];
      const payments = stateRef.current.commitmentPayments[input.potId] ?? [];
      const paid = calculateCommitmentPaid(commitment.id, payments, txs);
      const remaining = Math.max(commitment.totalAmount - paid, 0);
      const amountCheck = validateCommitmentPaymentAmount(remaining, input.amount);
      if (!amountCheck.valid) return { ok: false, reason: amountCheck.error! };

      try {
        const transactionId = await addCommitmentPaymentRemote({
          potId: input.potId,
          commitmentId: input.commitmentId,
          description: input.description,
          amount: input.amount,
          paidBy: input.paidBy,
          paymentSource: input.paymentSource,
          date: input.date,
          category: input.category,
          note: input.note,
          participants: input.participants,
          splitMethod: input.splitMethod,
          splits: input.splits,
          createdByMemberId: me.id,
        });
        await reloadWorkspace();
        return { ok: true, transactionId };
      } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : 'Could not save payment' };
      }
    },
    [reloadWorkspace],
  );

  const createCommitmentWithPayment = useCallback(
    async (input: CreateCommitmentWithPaymentInput): Promise<CreateCommitmentWithPaymentResult> => {
      const totalCheck = validateCommitmentTotalAmount(input.commitment.totalAmount);
      if (!totalCheck.valid) return { ok: false, reason: totalCheck.error! };
      const paymentCheck = validateCommitmentPaymentAmount(input.commitment.totalAmount, input.payment.amount);
      if (!paymentCheck.valid) return { ok: false, reason: paymentCheck.error! };

      const created = await createCommitment({ potId: input.potId, ...input.commitment });
      if (!created.ok) return created;

      const paid = await addCommitmentPayment({
        potId: input.potId,
        commitmentId: created.commitmentId,
        ...input.payment,
      });
      if (!paid.ok) return { ok: false, reason: paid.reason };

      return { ok: true, commitmentId: created.commitmentId, transactionId: paid.transactionId };
    },
    [createCommitment, addCommitmentPayment],
  );

  // ---------------------------------------------------------------------
  // Invitation & join request flow
  // ---------------------------------------------------------------------

  const requestToJoin = useCallback(
    async (input: RequestToJoinInput): Promise<RequestToJoinResult> => {
      const pot = stateRef.current.pots[input.potId];
      // Non-members may not have the pot in workspace; still attempt remote create.
      if (pot) {
        const channel = input.channel ?? 'invite_link';
        if (pot.status === 'archived') return { ok: false, reason: 'pot_archived' };
        if (channel === 'join_code' && !pot.joinEnabled) return { ok: false, reason: 'join_code_disabled' };
        if (channel !== 'join_code' && !pot.inviteEnabled) return { ok: false, reason: 'invite_disabled' };
      }

      try {
        const remote = await requestToJoinRemote({
          potId: input.potId,
          requestedName: input.requestedName,
        });
        const joinRequest: JoinRequest = {
          id: remote.joinRequestId,
          potId: input.potId,
          userId: stateRef.current.currentUser.id,
          requestedName: input.requestedName.trim(),
          status: 'pending',
          linkedMemberId: null,
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date().toISOString(),
        };

        if (remote.status === 'already_member') {
          const member = pot?.members.find((m) => m.id === remote.joinRequestId);
          if (member) return { ok: true, status: 'already_member', member };
          return { ok: true, status: 'already_member', member: { id: remote.joinRequestId, name: input.requestedName, role: 'member', accessLevel: 'member', status: 'active', userId: stateRef.current.currentUser.id, joinedAt: new Date().toISOString() } };
        }
        if (remote.status === 'already_pending') {
          return { ok: true, status: 'already_pending', joinRequest };
        }

        setState((prev) => {
          const existing = prev.joinRequests[input.potId] ?? [];
          if (existing.some((r) => r.id === joinRequest.id)) return prev;
          return {
            ...prev,
            joinRequests: { ...prev.joinRequests, [input.potId]: [...existing, joinRequest] },
          };
        });
        return { ok: true, status: 'created', joinRequest, joinRequests: [] };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('archived')) return { ok: false, reason: 'pot_archived' };
        throw err;
      }
    },
    [],
  );

  const approveExistingMember = useCallback(
    async (input: ApproveExistingMemberInput): Promise<ApproveJoinRequestResult> => {
      const pot = stateRef.current.pots[input.potId];
      if (!pot) return { ok: false, reason: 'pot_not_found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canReviewJoinRequests(me)) return { ok: false, reason: 'not_authorized' };

      try {
        await approveJoinRequestRemote({
          joinRequestId: input.joinRequestId,
          targetMemberId: input.memberId,
          newMemberDisplayName: input.displayName.trim(),
          accessLevel: input.accessLevel,
        });
        await reloadWorkspace();
        return { ok: true, members: [], joinRequests: [], linkedMemberId: input.memberId };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('already linked')) return { ok: false, reason: 'member_already_linked' };
        if (msg.includes('not pending')) return { ok: false, reason: 'request_not_pending' };
        if (msg.includes('not found')) return { ok: false, reason: 'request_not_found' };
        throw err;
      }
    },
    [reloadWorkspace],
  );

  const approveNewMember = useCallback(
    async (input: ApproveNewMemberInput): Promise<ApproveJoinRequestResult> => {
      const pot = stateRef.current.pots[input.potId];
      if (!pot) return { ok: false, reason: 'pot_not_found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canReviewJoinRequests(me)) return { ok: false, reason: 'not_authorized' };

      try {
        await approveJoinRequestRemote({
          joinRequestId: input.joinRequestId,
          targetMemberId: null,
          newMemberDisplayName: input.displayName,
          accessLevel: input.accessLevel,
        });
        await reloadWorkspace();
        return { ok: true, members: [], joinRequests: [], linkedMemberId: '' };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('not pending')) return { ok: false, reason: 'request_not_pending' };
        if (msg.includes('not found')) return { ok: false, reason: 'request_not_found' };
        throw err;
      }
    },
    [reloadWorkspace],
  );

  const rejectJoinRequest = useCallback(
    async (input: RejectJoinRequestInput): Promise<RejectJoinRequestResult> => {
      const pot = stateRef.current.pots[input.potId];
      if (!pot) return { ok: false, reason: 'pot_not_found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canReviewJoinRequests(me)) return { ok: false, reason: 'not_authorized' };

      try {
        await rejectJoinRequestRemote(input.joinRequestId);
        await reloadWorkspace();
        return { ok: true, joinRequests: [] };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('not pending')) return { ok: false, reason: 'request_not_pending' };
        if (msg.includes('not found')) return { ok: false, reason: 'request_not_found' };
        throw err;
      }
    },
    [reloadWorkspace],
  );

  const removeMember = useCallback(
    async (potId: string, memberId: string): Promise<{ ok: boolean; reason?: string }> => {
      const pot = stateRef.current.pots[potId];
      if (!pot) return { ok: false, reason: 'pot_not_found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canManageMembers(me) || !me) return { ok: false, reason: 'not_authorized' };
      if (me.id === memberId) return { ok: false, reason: 'cannot_remove_self' };
      try {
        await removeMemberRemote(potId, memberId);
        await reloadWorkspace();
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('permission') || msg.includes('not authorized')) return { ok: false, reason: 'not_authorized' };
        throw err;
      }
    },
    [reloadWorkspace],
  );

  const updateMember = useCallback(
    async (input: {
      potId: string;
      memberId: string;
      role?: 'admin' | 'member';
      accessLevel?: AccessLevel;
      displayName?: string;
    }): Promise<{ ok: boolean; reason?: string }> => {
      const pot = stateRef.current.pots[input.potId];
      if (!pot) return { ok: false, reason: 'pot_not_found' };
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canManageMembers(me)) return { ok: false, reason: 'not_authorized' };
      try {
        await updatePotMemberRemote({
          memberId: input.memberId,
          role: input.role,
          accessLevel: input.accessLevel,
          displayName: input.displayName,
        });
        await reloadWorkspace();
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (msg.includes('last admin')) return { ok: false, reason: 'last_admin' };
        if (msg.includes('not authorized')) return { ok: false, reason: 'not_authorized' };
        throw err;
      }
    },
    [reloadWorkspace],
  );

  const setInviteEnabled = useCallback(
    async (potId: string, enabled: boolean) => {
      const pot = stateRef.current.pots[potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditPot(me)) throw new Error('Not authorized');
      await setInviteEnabledRemote(potId, enabled);
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const regenerateInviteCode = useCallback(
    async (potId: string): Promise<string | undefined> => {
      const pot = stateRef.current.pots[potId];
      if (!pot) return undefined;
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditPot(me)) return undefined;
      const existing = new Set(await listInviteCodesRemote());
      const code = generateInviteCode(existing);
      await regenerateInviteCodeRemote(code, potId);
      await reloadWorkspace();
      return code;
    },
    [reloadWorkspace],
  );

  const setJoinEnabled = useCallback(
    async (potId: string, enabled: boolean) => {
      const pot = stateRef.current.pots[potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditPot(me)) throw new Error('Not authorized');
      await setJoinEnabledRemote(potId, enabled);
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const regenerateJoinCode = useCallback(
    async (potId: string): Promise<string | undefined> => {
      const pot = stateRef.current.pots[potId];
      if (!pot) return undefined;
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditPot(me)) return undefined;
      const existing = new Set(await listJoinCodesRemote());
      const code = generateJoinCode(existing);
      await regenerateJoinCodeRemote(code, potId);
      await reloadWorkspace();
      return code;
    },
    [reloadWorkspace],
  );

  const updatePotDetails = useCallback(
    async (
      potId: string,
      updates: { name?: string; description?: string; expectedContributionPerMember?: number | null },
    ) => {
      const pot = stateRef.current.pots[potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, stateRef.current.currentUser);
      if (!canEditPot(me)) throw new Error('Not authorized');
      await updatePotDetailsRemote(potId, updates);
      await reloadWorkspace();
    },
    [reloadWorkspace],
  );

  const archivePot = useCallback(
    async (potId: string) => {
      const pot = state.pots[potId];
      if (!pot) throw new Error('Pot not found');
      const me = resolveCurrentMember(pot, state.currentUser);
      if (!canArchivePot(me)) throw new Error('Not authorized');
      await archivePotRemote(potId);
      setState((prev) => {
        const p = prev.pots[potId];
        if (!p) return prev;
        return { ...prev, pots: { ...prev.pots, [potId]: { ...p, status: 'archived' } } };
      });
    },
    [state.pots, state.currentUser],
  );

  const value = useMemo<PottoContextValue>(
    () => ({
      state,
      getPot,
      getTransactions,
      getCurrentMember,
      getJoinRequests,
      getJoinRequest,
      getCommitments,
      getCommitment,
      getCommitmentPayments,
      hydrateWorkspace,
      reloadWorkspace,
      clearWorkspace,
      createPot,
      deletePot,
      addMoney,
      addExpense,
      recordSettlement,
      updateContribution,
      updateExpense,
      updateSettlement,
      deleteTransaction,
      createCommitment,
      updateCommitment,
      cancelCommitment,
      addCommitmentPayment,
      createCommitmentWithPayment,
      requestToJoin,
      approveExistingMember,
      approveNewMember,
      rejectJoinRequest,
      removeMember,
      updateMember,
      setInviteEnabled,
      regenerateInviteCode,
      setJoinEnabled,
      regenerateJoinCode,
      updatePotDetails,
      archivePot,
    }),
    [
      state,
      getPot,
      getTransactions,
      getCurrentMember,
      getJoinRequests,
      getJoinRequest,
      getCommitments,
      getCommitment,
      getCommitmentPayments,
      hydrateWorkspace,
      reloadWorkspace,
      clearWorkspace,
      createPot,
      deletePot,
      addMoney,
      addExpense,
      recordSettlement,
      updateContribution,
      updateExpense,
      updateSettlement,
      deleteTransaction,
      createCommitment,
      updateCommitment,
      cancelCommitment,
      addCommitmentPayment,
      createCommitmentWithPayment,
      requestToJoin,
      approveExistingMember,
      approveNewMember,
      rejectJoinRequest,
      removeMember,
      updateMember,
      setInviteEnabled,
      regenerateInviteCode,
      setJoinEnabled,
      regenerateJoinCode,
      updatePotDetails,
      archivePot,
    ],
  );

  return <PottoContext.Provider value={value}>{children}</PottoContext.Provider>;
}

export function usePottoStore(): PottoContextValue {
  const ctx = useContext(PottoContext);
  if (!ctx) throw new Error('usePottoStore must be used within a PottoProvider');
  return ctx;
}

// re-exported for convenience in screens
export { calculateExpenseShares };
