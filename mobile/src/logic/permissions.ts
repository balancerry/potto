import type { Commitment, Member, Transaction } from '@/types/models';

/**
 * Permission rules (spec section 13). This module is the enforcement boundary:
 * every mutating PottoStore action calls these before writing state, so a
 * button being hidden in the UI is never the only thing standing between a
 * view-only/removed member and a write. There is no real backend in this
 * prototype, so this in-process boundary is the closest equivalent to
 * server-side enforcement — see supabase/migrations for the RLS/RPC version.
 */

export function isActiveMember(member: Member | undefined): member is Member {
  return !!member && member.status === 'active';
}

export function isAdmin(member: Member | undefined): boolean {
  return isActiveMember(member) && member.role === 'admin';
}

export function isViewOnly(member: Member | undefined): boolean {
  return isActiveMember(member) && member.role !== 'admin' && member.accessLevel === 'view_only';
}

/** Admin, or a regular (non-view-only) active member. */
function hasWriteAccess(member: Member | undefined): boolean {
  return isAdmin(member) || (isActiveMember(member) && member.accessLevel === 'member');
}

export function canAddMoney(member: Member | undefined): boolean {
  return hasWriteAccess(member);
}

export function canAddExpense(member: Member | undefined): boolean {
  return hasWriteAccess(member);
}

export function canSettle(member: Member | undefined): boolean {
  return hasWriteAccess(member);
}

export function canInvite(member: Member | undefined): boolean {
  return hasWriteAccess(member);
}

export function canManageMembers(member: Member | undefined): boolean {
  return isAdmin(member);
}

export function canReviewJoinRequests(member: Member | undefined): boolean {
  return isAdmin(member);
}

export function canEditPot(member: Member | undefined): boolean {
  return isAdmin(member);
}

export function canArchivePot(member: Member | undefined): boolean {
  return isAdmin(member);
}

/** Admin can edit/delete any transaction; a regular member only their own; view-only never. */
export function canEditTransaction(member: Member | undefined, tx: Transaction): boolean {
  if (isAdmin(member)) return true;
  if (!hasWriteAccess(member) || !member) return false;
  return tx.createdBy === member.id;
}

export function canDeleteTransaction(member: Member | undefined, tx: Transaction): boolean {
  return canEditTransaction(member, tx);
}

/**
 * Commitments ("Upcoming Payments") permission rules (spec section 25).
 * Admin: create/edit/cancel/add-payments/view all. Member: create + add/link
 * their own payments if they'd otherwise be allowed to add an expense (same
 * write-access rule). View-only: view only, never write.
 */

/** Same write-access rule as canAddExpense — creating a Commitment is not itself money movement. */
export function canCreateCommitment(member: Member | undefined): boolean {
  return canAddExpense(member);
}

/** Admin can edit any Commitment; a regular member only one they created; view-only never. */
export function canEditCommitment(member: Member | undefined, commitment: Commitment): boolean {
  if (isAdmin(member)) return true;
  if (!canAddExpense(member) || !member) return false;
  return commitment.createdBy === member.id;
}

/** Cancelling is admin-only per spec's permission table. */
export function canCancelCommitment(member: Member | undefined): boolean {
  return isAdmin(member);
}

/** Adding/linking a payment creates a real expense transaction, so it follows the same rule as canAddExpense. */
export function canAddCommitmentPayment(member: Member | undefined): boolean {
  return canAddExpense(member);
}
