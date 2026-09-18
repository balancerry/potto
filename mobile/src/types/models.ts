export type MemberRole = 'admin' | 'member';

/** Access tier for non-admin members. Admins always have full access regardless of this. */
export type AccessLevel = 'member' | 'view_only';

/** 'inactive' on removal — the financial identity is preserved, never deleted. */
export type MemberStatus = 'active' | 'inactive';

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  accessLevel: AccessLevel;
  status: MemberStatus;
  /** Nullable link to a Potto account (`pot_member.user_id`). A member can exist before the person has an account. */
  userId?: string | null;
  joinedAt: string; // ISO date
}

/** The simulated authenticated identity for this device/session (no real backend exists yet). */
export interface PottoUser {
  id: string;
  name: string;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** A Potto user requesting access to a Pot. Never itself grants access. */
export interface JoinRequest {
  id: string;
  potId: string;
  userId: string;
  requestedName: string;
  status: JoinRequestStatus;
  linkedMemberId?: string | null;
  reviewedBy?: string | null; // memberId of the admin who reviewed it
  reviewedAt?: string | null;
  createdAt: string;
}

export type TransactionType = 'contribution' | 'pool_expense' | 'member_expense' | 'settlement';

export type SplitMethod = 'equal' | 'custom' | 'percentage';

export type PaymentSource = 'pool' | 'personal';

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';

export interface Split {
  memberId: string;
  amount: number; // paise
}

export interface Transaction {
  id: string;
  potId: string;
  type: TransactionType;
  description: string;
  amount: number; // paise
  date: string; // ISO date
  createdAt: string; // ISO datetime
  note?: string;
  category?: string;

  // contribution / member_expense: who paid/contributed
  paidBy?: string; // memberId

  // settlement only
  toMember?: string; // memberId receiving the settlement
  paymentMethod?: PaymentMethod; // settlement only, optional, defaults to "Not specified"

  // expense-only fields
  paymentSource?: PaymentSource;
  splitMethod?: SplitMethod;
  participants?: string[]; // memberIds
  splits?: Split[];

  createdBy: string; // memberId
}

export interface Pot {
  id: string;
  name: string;
  description?: string;
  currency: string;
  createdBy: string; // memberId
  // EXISTING invitation-link identity — untouched. Used only by /invite/[code]-style URLs.
  inviteCode: string;
  /** When false, the invite link is disabled and cannot be used to request access. */
  inviteEnabled: boolean;
  // NEW — a separate, zero-cost join method (manual entry / QR). Deliberately its
  // own field so it never repurposes or collides with inviteCode's identity.
  joinCode: string;
  /** When false, the join code is disabled and cannot be used to request access. */
  joinEnabled: boolean;
  /**
   * Optional per-member target contribution (paise), set by an admin at creation
   * or in Pot Settings. Purely informational — drives the Contributions tab's
   * "below/above expected" indicator only. Never affects balances, the pool,
   * or settlement; those remain derived solely from actual transactions.
   */
  expectedContributionPerMember?: number | null;
  status: 'active' | 'archived';
  createdAt: string;
  members: Member[];
}

export type CommitmentStatus = 'planned' | 'partially_paid' | 'fully_paid' | 'cancelled';

/**
 * A planned/agreed obligation (an "Upcoming Payment" in the UI) — not itself
 * an expense. `totalAmount` never affects Pool balance, Total Spent, member
 * balances, contributions, or settlements. Only actual linked Transactions
 * (via CommitmentPayment) do that. See src/logic/commitments.ts.
 */
export interface Commitment {
  id: string;
  potId: string;
  title: string;
  vendorName?: string;
  category?: string;
  description?: string;
  totalAmount: number; // paise
  dueDate?: string; // ISO date, optional
  /** 'cancelled' is the only status ever written directly; planned/partially_paid/fully_paid are always re-derived from linked payments (see deriveCommitmentStatus). */
  status: CommitmentStatus;
  createdBy: string; // memberId
  createdAt: string;
  updatedAt: string;
}

/**
 * Links one actual, existing Transaction to a Commitment. This is a
 * relationship, not a second ledger entry — the Transaction it points to
 * remains the sole source of truth for the money movement.
 */
export interface CommitmentPayment {
  id: string;
  potId: string; // denormalized like Transaction.potId, for isolation/lookup
  commitmentId: string;
  transactionId: string;
  amount: number; // paise — snapshot of the linked transaction's amount at link time
  createdAt: string;
}

export interface MemberBalance {
  memberId: string;
  contributed: number;
  expenseShare: number;
  paidForGroup: number;
  settlementsSent: number;
  settlementsReceived: number;
  net: number; // positive = should receive, negative = should pay
}

export interface SettlementTransfer {
  from: string; // memberId
  to: string; // memberId
  amount: number; // paise
}
