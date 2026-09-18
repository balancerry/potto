import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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
import { buildSeed } from '@/store/seed';
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
import { uid } from '@/utils/money';

interface PottoState {
  currentUser: PottoUser;
  currentUserName: string;
  pots: Record<string, Pot>;
  transactions: Record<string, Transaction[]>;
  joinRequests: Record<string, JoinRequest[]>;
  commitments: Record<string, Commitment[]>;
  commitmentPayments: Record<string, CommitmentPayment[]>;
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
  createPot: (input: CreatePotInput) => string;
  deletePot: (potId: string) => void;
  addMoney: (input: AddMoneyInput) => void;
  addExpense: (input: AddExpenseInput) => void;
  recordSettlement: (input: RecordSettlementInput) => void;
  updateContribution: (potId: string, txId: string, updates: UpdateContributionInput) => void;
  updateExpense: (potId: string, txId: string, updates: UpdateExpenseInput) => void;
  updateSettlement: (potId: string, txId: string, updates: UpdateSettlementInput) => void;
  deleteTransaction: (potId: string, txId: string) => void;
  createCommitment: (input: CreateCommitmentInput) => CreateCommitmentResult;
  updateCommitment: (potId: string, commitmentId: string, updates: UpdateCommitmentInput) => CommitmentActionResult;
  cancelCommitment: (potId: string, commitmentId: string) => CommitmentActionResult;
  addCommitmentPayment: (input: AddCommitmentPaymentInput) => AddCommitmentPaymentResult;
  createCommitmentWithPayment: (input: CreateCommitmentWithPaymentInput) => CreateCommitmentWithPaymentResult;
  requestToJoin: (input: RequestToJoinInput) => RequestToJoinResult;
  approveExistingMember: (input: ApproveExistingMemberInput) => ApproveJoinRequestResult;
  approveNewMember: (input: ApproveNewMemberInput) => ApproveJoinRequestResult;
  rejectJoinRequest: (input: RejectJoinRequestInput) => RejectJoinRequestResult;
  removeMember: (potId: string, memberId: string) => { ok: boolean; reason?: string };
  setInviteEnabled: (potId: string, enabled: boolean) => void;
  regenerateInviteCode: (potId: string) => string | undefined;
  setJoinEnabled: (potId: string, enabled: boolean) => void;
  regenerateJoinCode: (potId: string) => string | undefined;
  updatePotDetails: (
    potId: string,
    updates: { name?: string; description?: string; expectedContributionPerMember?: number | null },
  ) => void;
  archivePot: (potId: string) => void;
}

const PottoContext = createContext<PottoContextValue | null>(null);

export function PottoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PottoState>(() => {
    const seed = buildSeed();
    return {
      currentUser: seed.currentUser,
      currentUserName: seed.currentUserName,
      pots: seed.pots,
      transactions: seed.transactions,
      joinRequests: seed.joinRequests,
      commitments: seed.commitments,
      commitmentPayments: seed.commitmentPayments,
    };
  });

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

  const createPot = useCallback((input: CreatePotInput) => {
    const potId = uid('pot');
    let newPotId = potId;
    setState((prev) => {
      const joinedAt = new Date().toISOString().slice(0, 10);
      const creator: Member = {
        id: uid('mem'),
        name: prev.currentUser.name,
        role: 'admin',
        accessLevel: 'member',
        status: 'active',
        userId: prev.currentUser.id,
        joinedAt,
      };
      const members: Member[] = [
        creator,
        ...input.memberNames
          .map((n) => n.trim())
          .filter(Boolean)
          .map((name) => ({
            id: uid('mem'),
            name,
            role: 'member' as const,
            accessLevel: 'member' as const,
            status: 'active' as const,
            userId: null,
            joinedAt,
          })),
      ];
      const existingInviteCodes = new Set(Object.values(prev.pots).map((p) => p.inviteCode));
      const existingJoinCodes = new Set(Object.values(prev.pots).map((p) => p.joinCode));
      const pot: Pot = {
        id: potId,
        name: input.name,
        description: input.description,
        currency: 'INR',
        createdBy: creator.id,
        inviteCode: generateInviteCode(existingInviteCodes),
        inviteEnabled: true,
        joinCode: generateJoinCode(existingJoinCodes),
        joinEnabled: true,
        expectedContributionPerMember: input.expectedContributionPerMember && input.expectedContributionPerMember > 0 ? input.expectedContributionPerMember : null,
        status: 'active',
        createdAt: new Date().toISOString(),
        members,
      };
      const txs: Transaction[] = [];
      if (input.startingContribution && input.startingContribution > 0) {
        txs.push({
          id: uid('tx'),
          potId,
          type: 'contribution',
          description: 'Trip contribution',
          amount: input.startingContribution,
          paidBy: creator.id,
          date: joinedAt,
          createdAt: new Date().toISOString(),
          createdBy: creator.id,
          note: 'Initial contribution',
        });
      }
      newPotId = potId;
      return {
        ...prev,
        pots: { ...prev.pots, [potId]: pot },
        transactions: { ...prev.transactions, [potId]: txs },
        joinRequests: { ...prev.joinRequests, [potId]: [] },
        commitments: { ...prev.commitments, [potId]: [] },
        commitmentPayments: { ...prev.commitmentPayments, [potId]: [] },
      };
    });
    return newPotId;
  }, []);

  const deletePot = useCallback((potId: string) => {
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
  }, []);

  const addMoney = useCallback((input: AddMoneyInput) => {
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canAddMoney(me)) return prev;

      const createdAt = new Date().toISOString();
      const newTxs: Transaction[] = input.entries.map((entry) => ({
        id: uid('tx'),
        potId: input.potId,
        type: 'contribution',
        description: 'Contribution',
        amount: entry.amount,
        paidBy: entry.memberId,
        date: input.date,
        createdAt,
        createdBy: entry.memberId,
        note: input.note,
      }));
      const existing = prev.transactions[input.potId] ?? [];
      return {
        ...prev,
        transactions: { ...prev.transactions, [input.potId]: [...existing, ...newTxs] },
      };
    });
  }, []);

  const addExpense = useCallback((input: AddExpenseInput) => {
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canAddExpense(me)) return prev;

      const tx: Transaction = {
        id: uid('tx'),
        potId: input.potId,
        type: input.paymentSource === 'pool' ? 'pool_expense' : 'member_expense',
        description: input.description,
        amount: input.amount,
        paidBy: input.paidBy,
        paymentSource: input.paymentSource,
        category: input.category,
        participants: input.participants,
        splits: input.splits,
        splitMethod: input.splitMethod,
        date: input.date,
        createdAt: new Date().toISOString(),
        createdBy: input.paidBy,
        note: input.note,
      };
      const existing = prev.transactions[input.potId] ?? [];
      return {
        ...prev,
        transactions: { ...prev.transactions, [input.potId]: [...existing, tx] },
      };
    });
  }, []);

  const recordSettlement = useCallback((input: RecordSettlementInput) => {
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canSettle(me)) return prev;
      const memberIds = new Set(pot.members.map((m) => m.id));
      if (input.fromMemberId === input.toMemberId) return prev;
      if (!memberIds.has(input.fromMemberId) || !memberIds.has(input.toMemberId)) return prev;
      if (input.amount <= 0) return prev;

      const fromName = pot.members.find((m) => m.id === input.fromMemberId)?.name ?? '';
      const toName = pot.members.find((m) => m.id === input.toMemberId)?.name ?? '';
      const tx: Transaction = {
        id: uid('tx'),
        potId: input.potId,
        type: 'settlement',
        description: `${fromName} → ${toName}`,
        amount: input.amount,
        paidBy: input.fromMemberId,
        toMember: input.toMemberId,
        paymentMethod: input.paymentMethod,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        createdBy: input.fromMemberId,
        note: input.note,
      };
      const existing = prev.transactions[input.potId] ?? [];
      return {
        ...prev,
        transactions: { ...prev.transactions, [input.potId]: [...existing, tx] },
      };
    });
  }, []);

  const updateContribution = useCallback((potId: string, txId: string, updates: UpdateContributionInput) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      const existing = prev.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditTransaction(me, tx)) return prev;

      const next = existing.map((t) =>
        t.id === txId
          ? {
              ...t,
              paidBy: updates.memberId,
              amount: updates.amount,
              date: updates.date,
              note: updates.note,
              createdBy: updates.memberId,
            }
          : t,
      );
      return { ...prev, transactions: { ...prev.transactions, [potId]: next } };
    });
  }, []);

  const updateExpense = useCallback((potId: string, txId: string, updates: UpdateExpenseInput) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      const existing = prev.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditTransaction(me, tx)) return prev;

      const next = existing.map((t) =>
        t.id === txId
          ? {
              ...t,
              type: (updates.paymentSource === 'pool' ? 'pool_expense' : 'member_expense') as Transaction['type'],
              description: updates.description,
              amount: updates.amount,
              paidBy: updates.paidBy,
              paymentSource: updates.paymentSource,
              category: updates.category,
              participants: updates.participants,
              splits: updates.splits,
              splitMethod: updates.splitMethod,
              date: updates.date,
              note: updates.note,
              createdBy: updates.paidBy,
            }
          : t,
      );
      return { ...prev, transactions: { ...prev.transactions, [potId]: next } };
    });
  }, []);

  const updateSettlement = useCallback((potId: string, txId: string, updates: UpdateSettlementInput) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const existing = prev.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!tx) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditTransaction(me, tx)) return prev;

      const memberIds = new Set(pot.members.map((m) => m.id));
      if (updates.fromMemberId === updates.toMemberId) return prev;
      if (!memberIds.has(updates.fromMemberId) || !memberIds.has(updates.toMemberId)) return prev;
      if (updates.amount <= 0) return prev;

      const fromName = pot.members.find((m) => m.id === updates.fromMemberId)?.name ?? '';
      const toName = pot.members.find((m) => m.id === updates.toMemberId)?.name ?? '';
      const next = existing.map((t) =>
        t.id === txId
          ? {
              ...t,
              description: `${fromName} → ${toName}`,
              amount: updates.amount,
              paidBy: updates.fromMemberId,
              toMember: updates.toMemberId,
              paymentMethod: updates.paymentMethod,
              date: updates.date,
              note: updates.note,
              createdBy: updates.fromMemberId,
            }
          : t,
      );
      return { ...prev, transactions: { ...prev.transactions, [potId]: next } };
    });
  }, []);

  const deleteTransaction = useCallback((potId: string, txId: string) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      const existing = prev.transactions[potId] ?? [];
      const tx = existing.find((t) => t.id === txId);
      if (!pot || !tx) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canDeleteTransaction(me, tx)) return prev;

      // Cascade: a deleted transaction's paid amount must stop counting toward
      // any Commitment it was linked to, and the orphaned link itself must not
      // remain (spec section 27). calculateCommitmentPaid would already treat
      // a payment pointing at a missing transaction as 0, but removing the row
      // keeps state clean rather than leaving a dangling reference around.
      const existingPayments = prev.commitmentPayments[potId] ?? [];
      const nextPayments = existingPayments.filter((p) => p.transactionId !== txId);

      return {
        ...prev,
        transactions: { ...prev.transactions, [potId]: existing.filter((t) => t.id !== txId) },
        commitmentPayments: { ...prev.commitmentPayments, [potId]: nextPayments },
      };
    });
  }, []);

  // ---------------------------------------------------------------------
  // Commitments ("Upcoming Payments")
  //
  // A Commitment is a planned obligation, never itself money movement — its
  // create/edit/cancel actions never touch `transactions`. Only
  // addCommitmentPayment / createCommitmentWithPayment create a real
  // Transaction, and they always do so in the same setState pass as the
  // CommitmentPayment link, so the two can never exist independently
  // (spec sections 3, 12, 29 items 24-25: "commitment created but
  // transaction fails" / "transaction created but commitment link fails"
  // are impossible here because there is no await between them — this
  // reducer's synchronous setState callback is the whole operation).
  // ---------------------------------------------------------------------

  const createCommitment = useCallback((input: CreateCommitmentInput): CreateCommitmentResult => {
    let result: CreateCommitmentResult = { ok: false, reason: 'Pot not found' };
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canCreateCommitment(me) || !me) {
        result = { ok: false, reason: 'Not authorized' };
        return prev;
      }
      if (!input.title.trim()) {
        result = { ok: false, reason: 'Enter a title' };
        return prev;
      }
      const amountCheck = validateCommitmentTotalAmount(input.totalAmount);
      if (!amountCheck.valid) {
        result = { ok: false, reason: amountCheck.error! };
        return prev;
      }

      const id = uid('cmt');
      const now = new Date().toISOString();
      const commitment: Commitment = {
        id,
        potId: input.potId,
        title: input.title.trim(),
        vendorName: input.vendorName?.trim() || undefined,
        category: input.category,
        description: input.description?.trim() || undefined,
        totalAmount: input.totalAmount,
        dueDate: input.dueDate,
        status: 'planned',
        createdBy: me.id,
        createdAt: now,
        updatedAt: now,
      };
      result = { ok: true, commitmentId: id };
      const existing = prev.commitments[input.potId] ?? [];
      return { ...prev, commitments: { ...prev.commitments, [input.potId]: [...existing, commitment] } };
    });
    return result;
  }, []);

  const updateCommitment = useCallback(
    (potId: string, commitmentId: string, updates: UpdateCommitmentInput): CommitmentActionResult => {
      let result: CommitmentActionResult = { ok: false, reason: 'Upcoming payment not found' };
      setState((prev) => {
        const pot = prev.pots[potId];
        const existing = prev.commitments[potId] ?? [];
        const commitment = existing.find((c) => c.id === commitmentId);
        if (!pot || !commitment) return prev;
        const me = resolveCurrentMember(pot, prev.currentUser);
        if (!canEditCommitment(me, commitment)) {
          result = { ok: false, reason: 'Not authorized' };
          return prev;
        }
        if (!updates.title.trim()) {
          result = { ok: false, reason: 'Enter a title' };
          return prev;
        }
        const amountCheck = validateCommitmentTotalAmount(updates.totalAmount);
        if (!amountCheck.valid) {
          result = { ok: false, reason: amountCheck.error! };
          return prev;
        }

        result = { ok: true };
        // Historical transactions are never touched by a total-amount change
        // (spec section 19) — only the Commitment row itself is updated;
        // remaining is always recomputed live from the existing payments.
        const next = existing.map((c) =>
          c.id === commitmentId
            ? {
                ...c,
                title: updates.title.trim(),
                vendorName: updates.vendorName?.trim() || undefined,
                category: updates.category,
                description: updates.description?.trim() || undefined,
                totalAmount: updates.totalAmount,
                dueDate: updates.dueDate,
                updatedAt: new Date().toISOString(),
              }
            : c,
        );
        return { ...prev, commitments: { ...prev.commitments, [potId]: next } };
      });
      return result;
    },
    [],
  );

  const cancelCommitment = useCallback((potId: string, commitmentId: string): CommitmentActionResult => {
    let result: CommitmentActionResult = { ok: false, reason: 'Upcoming payment not found' };
    setState((prev) => {
      const pot = prev.pots[potId];
      const existing = prev.commitments[potId] ?? [];
      const commitment = existing.find((c) => c.id === commitmentId);
      if (!pot || !commitment) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canCancelCommitment(me)) {
        result = { ok: false, reason: 'Not authorized' };
        return prev;
      }
      result = { ok: true };
      // Cancelling never deletes the Commitment or its historical payments/transactions (spec section 20).
      const next = existing.map((c) =>
        c.id === commitmentId ? { ...c, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : c,
      );
      return { ...prev, commitments: { ...prev.commitments, [potId]: next } };
    });
    return result;
  }, []);

  const addCommitmentPayment = useCallback((input: AddCommitmentPaymentInput): AddCommitmentPaymentResult => {
    let result: AddCommitmentPaymentResult = { ok: false, reason: 'Pot not found' };
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canAddCommitmentPayment(me)) {
        result = { ok: false, reason: 'Not authorized' };
        return prev;
      }
      const commitments = prev.commitments[input.potId] ?? [];
      const commitment = commitments.find((c) => c.id === input.commitmentId);
      if (!commitment) {
        result = { ok: false, reason: 'Upcoming payment not found' };
        return prev;
      }
      // Cross-Pot linking is impossible by construction (commitment was looked
      // up inside prev.commitments[input.potId]), but this also guards against
      // a stale/forged commitmentId belonging to a different pot's list shape.
      if (commitment.potId !== input.potId) {
        result = { ok: false, reason: 'This Upcoming Payment does not belong to this Pot' };
        return prev;
      }
      if (commitment.status === 'cancelled') {
        result = { ok: false, reason: 'This Upcoming Payment has been cancelled' };
        return prev;
      }

      const txs = prev.transactions[input.potId] ?? [];
      const payments = prev.commitmentPayments[input.potId] ?? [];
      const paid = calculateCommitmentPaid(commitment.id, payments, txs);
      const remaining = Math.max(commitment.totalAmount - paid, 0);
      const amountCheck = validateCommitmentPaymentAmount(remaining, input.amount);
      if (!amountCheck.valid) {
        result = { ok: false, reason: amountCheck.error! };
        return prev;
      }

      const now = new Date().toISOString();
      const txId = uid('tx');
      const tx: Transaction = {
        id: txId,
        potId: input.potId,
        type: input.paymentSource === 'pool' ? 'pool_expense' : 'member_expense',
        description: input.description,
        amount: input.amount,
        paidBy: input.paidBy,
        paymentSource: input.paymentSource,
        category: input.category,
        participants: input.participants,
        splits: input.splits,
        splitMethod: input.splitMethod,
        date: input.date,
        createdAt: now,
        createdBy: input.paidBy,
        note: input.note,
      };
      const payment: CommitmentPayment = {
        id: uid('cpay'),
        potId: input.potId,
        commitmentId: commitment.id,
        transactionId: txId,
        amount: input.amount,
        createdAt: now,
      };
      result = { ok: true, transactionId: txId };
      return {
        ...prev,
        transactions: { ...prev.transactions, [input.potId]: [...txs, tx] },
        commitmentPayments: { ...prev.commitmentPayments, [input.potId]: [...payments, payment] },
      };
    });
    return result;
  }, []);

  const createCommitmentWithPayment = useCallback(
    (input: CreateCommitmentWithPaymentInput): CreateCommitmentWithPaymentResult => {
      let result: CreateCommitmentWithPaymentResult = { ok: false, reason: 'Pot not found' };
      setState((prev) => {
        const pot = prev.pots[input.potId];
        if (!pot) return prev;
        const me = resolveCurrentMember(pot, prev.currentUser);
        if (!canCreateCommitment(me) || !canAddCommitmentPayment(me) || !me) {
          result = { ok: false, reason: 'Not authorized' };
          return prev;
        }
        if (!input.commitment.title.trim()) {
          result = { ok: false, reason: 'Enter a title' };
          return prev;
        }
        const totalCheck = validateCommitmentTotalAmount(input.commitment.totalAmount);
        if (!totalCheck.valid) {
          result = { ok: false, reason: totalCheck.error! };
          return prev;
        }
        // The initial payment can never exceed the brand-new commitment's total (nothing paid yet, so "remaining" is the full total).
        const paymentCheck = validateCommitmentPaymentAmount(input.commitment.totalAmount, input.payment.amount);
        if (!paymentCheck.valid) {
          result = { ok: false, reason: paymentCheck.error! };
          return prev;
        }

        const now = new Date().toISOString();
        const commitmentId = uid('cmt');
        const commitment: Commitment = {
          id: commitmentId,
          potId: input.potId,
          title: input.commitment.title.trim(),
          vendorName: input.commitment.vendorName?.trim() || undefined,
          category: input.commitment.category,
          description: input.commitment.description?.trim() || undefined,
          totalAmount: input.commitment.totalAmount,
          dueDate: input.commitment.dueDate,
          status: 'planned',
          createdBy: me.id,
          createdAt: now,
          updatedAt: now,
        };

        const txId = uid('tx');
        const p = input.payment;
        const tx: Transaction = {
          id: txId,
          potId: input.potId,
          type: p.paymentSource === 'pool' ? 'pool_expense' : 'member_expense',
          description: p.description,
          amount: p.amount,
          paidBy: p.paidBy,
          paymentSource: p.paymentSource,
          category: p.category,
          participants: p.participants,
          splits: p.splits,
          splitMethod: p.splitMethod,
          date: p.date,
          createdAt: now,
          createdBy: p.paidBy,
          note: p.note,
        };
        const payment: CommitmentPayment = {
          id: uid('cpay'),
          potId: input.potId,
          commitmentId,
          transactionId: txId,
          amount: p.amount,
          createdAt: now,
        };

        result = { ok: true, commitmentId, transactionId: txId };
        const existingCommitments = prev.commitments[input.potId] ?? [];
        const existingTxs = prev.transactions[input.potId] ?? [];
        const existingPayments = prev.commitmentPayments[input.potId] ?? [];
        return {
          ...prev,
          commitments: { ...prev.commitments, [input.potId]: [...existingCommitments, commitment] },
          transactions: { ...prev.transactions, [input.potId]: [...existingTxs, tx] },
          commitmentPayments: { ...prev.commitmentPayments, [input.potId]: [...existingPayments, payment] },
        };
      });
      return result;
    },
    [],
  );

  // ---------------------------------------------------------------------
  // Invitation & join request flow
  // ---------------------------------------------------------------------

  const requestToJoin = useCallback((input: RequestToJoinInput): RequestToJoinResult => {
    let result: RequestToJoinResult = { ok: false, reason: 'pot_not_found' };
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const existing = prev.joinRequests[input.potId] ?? [];
      const outcome = JoinFlow.createJoinRequest(pot, existing, prev.currentUser, input.requestedName, input.channel);
      result = outcome;
      if (outcome.ok && outcome.status === 'created') {
        return { ...prev, joinRequests: { ...prev.joinRequests, [input.potId]: outcome.joinRequests } };
      }
      return prev;
    });
    return result;
  }, []);

  const approveExistingMember = useCallback((input: ApproveExistingMemberInput): ApproveJoinRequestResult => {
    let result: ApproveJoinRequestResult = { ok: false, reason: 'pot_not_found' };
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canReviewJoinRequests(me)) {
        result = { ok: false, reason: 'not_authorized' };
        return prev;
      }
      const existing = prev.joinRequests[input.potId] ?? [];
      const outcome = JoinFlow.approveExistingMember(pot, existing, {
        joinRequestId: input.joinRequestId,
        memberId: input.memberId,
        accessLevel: input.accessLevel,
        reviewerMemberId: me!.id,
      });
      result = outcome;
      if (!outcome.ok) return prev;
      return {
        ...prev,
        pots: { ...prev.pots, [input.potId]: { ...pot, members: outcome.members } },
        joinRequests: { ...prev.joinRequests, [input.potId]: outcome.joinRequests },
      };
    });
    return result;
  }, []);

  const approveNewMember = useCallback((input: ApproveNewMemberInput): ApproveJoinRequestResult => {
    let result: ApproveJoinRequestResult = { ok: false, reason: 'pot_not_found' };
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canReviewJoinRequests(me)) {
        result = { ok: false, reason: 'not_authorized' };
        return prev;
      }
      const existing = prev.joinRequests[input.potId] ?? [];
      const outcome = JoinFlow.approveNewMember(pot, existing, {
        joinRequestId: input.joinRequestId,
        displayName: input.displayName,
        accessLevel: input.accessLevel,
        reviewerMemberId: me!.id,
      });
      result = outcome;
      if (!outcome.ok) return prev;
      return {
        ...prev,
        pots: { ...prev.pots, [input.potId]: { ...pot, members: outcome.members } },
        joinRequests: { ...prev.joinRequests, [input.potId]: outcome.joinRequests },
      };
    });
    return result;
  }, []);

  const rejectJoinRequest = useCallback((input: RejectJoinRequestInput): RejectJoinRequestResult => {
    let result: RejectJoinRequestResult = { ok: false, reason: 'pot_not_found' };
    setState((prev) => {
      const pot = prev.pots[input.potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canReviewJoinRequests(me)) {
        result = { ok: false, reason: 'not_authorized' };
        return prev;
      }
      const existing = prev.joinRequests[input.potId] ?? [];
      const outcome = JoinFlow.rejectJoinRequest(pot, existing, {
        joinRequestId: input.joinRequestId,
        reviewerMemberId: me!.id,
      });
      result = outcome;
      if (!outcome.ok) return prev;
      return { ...prev, joinRequests: { ...prev.joinRequests, [input.potId]: outcome.joinRequests } };
    });
    return result;
  }, []);

  const removeMember = useCallback((potId: string, memberId: string): { ok: boolean; reason?: string } => {
    let result: { ok: boolean; reason?: string } = { ok: false, reason: 'pot_not_found' };
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canManageMembers(me)) {
        result = { ok: false, reason: 'not_authorized' };
        return prev;
      }
      const members = JoinFlow.removeMember(pot, memberId);
      result = { ok: true };
      return { ...prev, pots: { ...prev.pots, [potId]: { ...pot, members } } };
    });
    return result;
  }, []);

  const setInviteEnabled = useCallback((potId: string, enabled: boolean) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditPot(me)) return prev;
      return { ...prev, pots: { ...prev.pots, [potId]: JoinFlow.setInviteEnabled(pot, enabled) } };
    });
  }, []);

  const regenerateInviteCode = useCallback((potId: string): string | undefined => {
    let newCode: string | undefined;
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditPot(me)) return prev;
      const existingCodes = new Set(Object.values(prev.pots).map((p) => p.inviteCode));
      const code = generateInviteCode(existingCodes);
      newCode = code;
      return { ...prev, pots: { ...prev.pots, [potId]: { ...pot, inviteCode: code } } };
    });
    return newCode;
  }, []);

  // NEW — same pattern as setInviteEnabled/regenerateInviteCode above, for the
  // separate Join Code channel. The invite-link actions above are untouched.
  const setJoinEnabled = useCallback((potId: string, enabled: boolean) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditPot(me)) return prev;
      return { ...prev, pots: { ...prev.pots, [potId]: JoinFlow.setJoinEnabled(pot, enabled) } };
    });
  }, []);

  const regenerateJoinCode = useCallback((potId: string): string | undefined => {
    let newCode: string | undefined;
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canEditPot(me)) return prev;
      const existingCodes = new Set(Object.values(prev.pots).map((p) => p.joinCode));
      const code = generateJoinCode(existingCodes);
      newCode = code;
      return { ...prev, pots: { ...prev.pots, [potId]: { ...pot, joinCode: code } } };
    });
    return newCode;
  }, []);

  const updatePotDetails = useCallback(
    (potId: string, updates: { name?: string; description?: string; expectedContributionPerMember?: number | null }) => {
      setState((prev) => {
        const pot = prev.pots[potId];
        if (!pot) return prev;
        const me = resolveCurrentMember(pot, prev.currentUser);
        if (!canEditPot(me)) return prev;
        return { ...prev, pots: { ...prev.pots, [potId]: { ...pot, ...updates } } };
      });
    },
    [],
  );

  const archivePot = useCallback((potId: string) => {
    setState((prev) => {
      const pot = prev.pots[potId];
      if (!pot) return prev;
      const me = resolveCurrentMember(pot, prev.currentUser);
      if (!canArchivePot(me)) return prev;
      return { ...prev, pots: { ...prev.pots, [potId]: { ...pot, status: 'archived' } } };
    });
  }, []);

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
