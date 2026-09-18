import type { Commitment, CommitmentPayment, CommitmentStatus, Transaction } from '@/types/models';

/**
 * Pure, DOM/UI-free logic for Commitments ("Upcoming Payments"). Mirrors the
 * shape of accounting.ts: everything here is derived fresh from the
 * Commitment + CommitmentPayment + Transaction data every time, nothing is
 * cached.
 *
 * Core rule (spec sections 2-4): a Commitment is a planned obligation, not an
 * expense. It never feeds calculatePoolBalance / calculateTotalSpent /
 * calculateMemberBalances in accounting.ts. Only the real Transaction that a
 * CommitmentPayment points at moves money.
 */

/**
 * Paid amount is looked up live against the linked transaction's *current*
 * amount, not a frozen snapshot. This is what makes editing or deleting a
 * linked transaction automatically correct (spec section 27): if the
 * transaction's amount changes, paid changes with it; if the transaction no
 * longer exists (deleted), that payment contributes nothing — never an
 * orphaned amount left counting toward "Paid".
 */
export function calculateCommitmentPaid(
  commitmentId: string,
  payments: CommitmentPayment[],
  transactions: Transaction[],
): number {
  const txById = new Map(transactions.map((t) => [t.id, t]));
  return payments
    .filter((p) => p.commitmentId === commitmentId)
    .reduce((sum, p) => {
      const tx = txById.get(p.transactionId);
      return tx ? sum + tx.amount : sum;
    }, 0);
}

export function calculateCommitmentRemaining(
  commitment: Commitment,
  payments: CommitmentPayment[],
  transactions: Transaction[],
): number {
  const paid = calculateCommitmentPaid(commitment.id, payments, transactions);
  return Math.max(commitment.totalAmount - paid, 0);
}

/**
 * `cancelled` is the only status ever written directly by a user action
 * (cancelCommitment). planned / partially_paid / fully_paid are always
 * re-derived here from the live paid amount, so they can never drift out of
 * sync with the actual linked transactions.
 */
export function deriveCommitmentStatus(commitment: Commitment, paidAmount: number): CommitmentStatus {
  if (commitment.status === 'cancelled') return 'cancelled';
  if (paidAmount <= 0) return 'planned';
  if (paidAmount >= commitment.totalAmount) return 'fully_paid';
  return 'partially_paid';
}

export type DueDateState = 'upcoming' | 'due_soon' | 'due_today' | 'overdue' | 'paid' | 'cancelled' | 'no_due_date';

const DUE_SOON_WINDOW_DAYS = 3;

/**
 * Derived purely from due date + status (spec section 18: "do not
 * unnecessarily store derived display state"). `todayISO` is injectable for
 * deterministic tests.
 */
export function deriveDueDateState(
  commitment: Commitment,
  status: CommitmentStatus,
  todayISO: string = new Date().toISOString().slice(0, 10),
): DueDateState {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'fully_paid') return 'paid';
  if (!commitment.dueDate) return 'no_due_date';
  if (commitment.dueDate < todayISO) return 'overdue';
  if (commitment.dueDate === todayISO) return 'due_today';
  const days = Math.round((Date.parse(commitment.dueDate) - Date.parse(todayISO)) / 86_400_000);
  return days <= DUE_SOON_WINDOW_DAYS ? 'due_soon' : 'upcoming';
}

/** Sum of remaining amounts across every non-cancelled commitment in a Pot — the dashboard's "Upcoming Payments" total (spec section 16). Never included in Total Spent. */
export function calculateTotalUpcomingRemaining(
  commitments: Commitment[],
  payments: CommitmentPayment[],
  transactions: Transaction[],
): number {
  return commitments
    .filter((c) => c.status !== 'cancelled')
    .reduce((sum, c) => sum + calculateCommitmentRemaining(c, payments, transactions), 0);
}

/** Informational only (spec section 17) — never creates a debt, balance, or settlement. */
export function calculatePotentialShortfall(poolBalancePaise: number, upcomingRemainingPaise: number): number {
  return Math.max(upcomingRemainingPaise - poolBalancePaise, 0);
}

export interface CommitmentValidationResult {
  valid: boolean;
  error?: string;
}

/** For MVP, a payment can never exceed the remaining commitment amount (spec section 23). */
export function validateCommitmentPaymentAmount(
  remainingPaise: number,
  amountPaise: number,
): CommitmentValidationResult {
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { valid: false, error: 'Enter an amount greater than zero' };
  }
  if (amountPaise > remainingPaise) {
    return {
      valid: false,
      error: `Payment exceeds remaining commitment amount by ${formatMoneyPaise(amountPaise - remainingPaise)}.`,
    };
  }
  return { valid: true };
}

export function validateCommitmentTotalAmount(totalAmountPaise: number): CommitmentValidationResult {
  if (!Number.isFinite(totalAmountPaise) || totalAmountPaise <= 0) {
    return { valid: false, error: 'Enter a total amount greater than zero' };
  }
  return { valid: true };
}

// Local, dependency-free money formatter so this file has no UI imports.
// Kept in sync with the decimal-precision rules in src/utils/money.ts (see
// the identical copy in accounting.ts).
function formatMoneyPaise(paise: number): string {
  const abs = Math.round(Math.abs(paise));
  const hasPaise = abs % 100 !== 0;
  const rupees = abs / 100;
  const str = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  });
  return `₹${str}`;
}
