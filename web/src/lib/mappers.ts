import type {
  AccessLevel,
  Commitment,
  CommitmentPayment,
  CommitmentStatus,
  JoinRequest,
  JoinRequestStatus,
  Member,
  MemberRole,
  MemberStatus,
  PaymentMethod,
  PaymentSource,
  Pot,
  PottoUser,
  Split,
  SplitMethod,
  Transaction,
  TransactionType,
} from '@/lib/core/models';

/** Raw pot_members row from Postgres. */
export interface MemberRow {
  id: string;
  pot_id?: string;
  user_id: string | null;
  display_name: string;
  role: string;
  access_level: string;
  status: string;
  created_at: string;
}

/** Raw pots row from Postgres. */
export interface PotRow {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_by: string;
  invite_code: string;
  invite_enabled: boolean;
  join_code: string;
  join_enabled: boolean;
  expected_contribution_per_member: number | null;
  status: string;
  created_at: string;
}

/** Raw transactions row (without splits). */
export interface TransactionRow {
  id: string;
  pot_id: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  note: string | null;
  category: string | null;
  paid_by: string | null;
  to_member: string | null;
  payment_method: string | null;
  payment_source: string | null;
  split_method: string | null;
  participants: string[] | null;
  created_by: string;
  created_at: string;
}

export interface SplitRow {
  id?: string;
  transaction_id?: string;
  member_id: string;
  amount: number;
}

export interface JoinRequestRow {
  id: string;
  pot_id: string;
  user_id: string;
  requested_name: string;
  status: string;
  linked_member_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CommitmentRow {
  id: string;
  pot_id: string;
  title: string;
  vendor_name: string | null;
  category: string | null;
  description: string | null;
  total_amount: number;
  due_date: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CommitmentPaymentRow {
  id: string;
  pot_id: string;
  commitment_id: string;
  transaction_id: string;
  amount: number;
  created_at: string;
}

export interface UserRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  created_at?: string;
}

function dateSlice(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function optString(value: string | null | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  return value;
}

export function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.display_name,
    role: row.role as MemberRole,
    accessLevel: row.access_level as AccessLevel,
    status: row.status as MemberStatus,
    userId: row.user_id,
    joinedAt: dateSlice(row.created_at),
  };
}

/**
 * Maps a pot row + members. Domain `Pot.createdBy` is a member id;
 * DB `created_by` is the auth user id — resolve to the admin member when possible.
 */
export function mapPot(row: PotRow, members: Member[]): Pot {
  const creatorMember =
    members.find((m) => m.userId === row.created_by && m.role === 'admin') ??
    members.find((m) => m.role === 'admin') ??
    members.find((m) => m.userId === row.created_by) ??
    members[0];

  return {
    id: row.id,
    name: row.name,
    description: optString(row.description),
    currency: row.currency,
    createdBy: creatorMember?.id ?? row.created_by,
    inviteCode: row.invite_code,
    inviteEnabled: row.invite_enabled,
    joinCode: row.join_code,
    joinEnabled: row.join_enabled,
    expectedContributionPerMember: row.expected_contribution_per_member,
    status: row.status as Pot['status'],
    createdAt: row.created_at,
    members,
  };
}

export function mapSplit(row: SplitRow): Split {
  return {
    memberId: row.member_id,
    amount: Number(row.amount),
  };
}

export function mapTransaction(row: TransactionRow, splits: Split[] = []): Transaction {
  const tx: Transaction = {
    id: row.id,
    potId: row.pot_id,
    type: row.type as TransactionType,
    description: row.description,
    amount: Number(row.amount),
    date: dateSlice(row.date),
    createdAt: row.created_at,
    createdBy: row.created_by,
  };

  if (row.note != null && row.note !== '') tx.note = row.note;
  if (row.category != null && row.category !== '') tx.category = row.category;
  if (row.paid_by) tx.paidBy = row.paid_by;
  if (row.to_member) tx.toMember = row.to_member;
  if (row.payment_method) tx.paymentMethod = row.payment_method as PaymentMethod;
  if (row.payment_source) tx.paymentSource = row.payment_source as PaymentSource;
  if (row.split_method) tx.splitMethod = row.split_method as SplitMethod;
  if (row.participants && row.participants.length > 0) tx.participants = row.participants;
  if (splits.length > 0) tx.splits = splits;

  return tx;
}

export function mapJoinRequest(row: JoinRequestRow): JoinRequest {
  return {
    id: row.id,
    potId: row.pot_id,
    userId: row.user_id,
    requestedName: row.requested_name,
    status: row.status as JoinRequestStatus,
    linkedMemberId: row.linked_member_id,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export function mapCommitment(row: CommitmentRow): Commitment {
  return {
    id: row.id,
    potId: row.pot_id,
    title: row.title,
    vendorName: optString(row.vendor_name),
    category: optString(row.category),
    description: optString(row.description),
    totalAmount: Number(row.total_amount),
    dueDate: row.due_date ? dateSlice(row.due_date) : undefined,
    status: row.status as CommitmentStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCommitmentPayment(row: CommitmentPaymentRow): CommitmentPayment {
  return {
    id: row.id,
    potId: row.pot_id,
    commitmentId: row.commitment_id,
    transactionId: row.transaction_id,
    amount: Number(row.amount),
    createdAt: row.created_at,
  };
}

export function mapUser(row: UserRow): PottoUser {
  return {
    id: row.id,
    name: row.name,
  };
}
