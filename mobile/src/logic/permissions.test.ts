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
  canInvite,
  canManageMembers,
  canReviewJoinRequests,
  canSettle,
  isAdmin,
  isViewOnly,
} from '@/logic/permissions';
import type { Commitment, Member, Transaction } from '@/types/models';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'mem_1',
    name: 'Test',
    role: 'member',
    accessLevel: 'member',
    status: 'active',
    userId: null,
    joinedAt: '2026-01-01',
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    potId: 'pot_1',
    type: 'contribution',
    description: 'x',
    amount: 100,
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'mem_1',
    ...overrides,
  };
}

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'cmt_1',
    potId: 'pot_1',
    title: 'Hotel',
    totalAmount: 100,
    status: 'planned',
    createdBy: 'mem_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('admin', () => {
  const admin = makeMember({ role: 'admin' });
  it('can do everything', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(canAddMoney(admin)).toBe(true);
    expect(canAddExpense(admin)).toBe(true);
    expect(canSettle(admin)).toBe(true);
    expect(canInvite(admin)).toBe(true);
    expect(canManageMembers(admin)).toBe(true);
    expect(canReviewJoinRequests(admin)).toBe(true);
    expect(canEditPot(admin)).toBe(true);
    expect(canArchivePot(admin)).toBe(true);
  });

  it('can edit and delete any transaction, not just their own', () => {
    const othersTx = makeTx({ createdBy: 'someone_else' });
    expect(canEditTransaction(admin, othersTx)).toBe(true);
    expect(canDeleteTransaction(admin, othersTx)).toBe(true);
  });

  it('can create, edit any, cancel, and add payments to Commitments', () => {
    const othersCommitment = makeCommitment({ createdBy: 'someone_else' });
    expect(canCreateCommitment(admin)).toBe(true);
    expect(canEditCommitment(admin, othersCommitment)).toBe(true);
    expect(canCancelCommitment(admin)).toBe(true);
    expect(canAddCommitmentPayment(admin)).toBe(true);
  });
});

describe('member', () => {
  const member = makeMember({ role: 'member', accessLevel: 'member', id: 'mem_1' });
  it('can transact but not manage the pot', () => {
    expect(canAddMoney(member)).toBe(true);
    expect(canAddExpense(member)).toBe(true);
    expect(canSettle(member)).toBe(true);
    expect(canInvite(member)).toBe(true);
    expect(canManageMembers(member)).toBe(false);
    expect(canReviewJoinRequests(member)).toBe(false);
    expect(canEditPot(member)).toBe(false);
  });

  it('can edit their own entries but not others’', () => {
    const own = makeTx({ createdBy: 'mem_1' });
    const others = makeTx({ createdBy: 'mem_2' });
    expect(canEditTransaction(member, own)).toBe(true);
    expect(canEditTransaction(member, others)).toBe(false);
    expect(canDeleteTransaction(member, others)).toBe(false);
  });

  it('can create Commitments and add payments, edit only their own, and never cancel', () => {
    const own = makeCommitment({ createdBy: 'mem_1' });
    const others = makeCommitment({ createdBy: 'mem_2' });
    expect(canCreateCommitment(member)).toBe(true);
    expect(canAddCommitmentPayment(member)).toBe(true);
    expect(canEditCommitment(member, own)).toBe(true);
    expect(canEditCommitment(member, others)).toBe(false);
    expect(canCancelCommitment(member)).toBe(false);
  });
});

describe('view only', () => {
  const viewOnly = makeMember({ role: 'member', accessLevel: 'view_only', id: 'mem_1' });
  it('cannot write anything, even its own transaction', () => {
    expect(isViewOnly(viewOnly)).toBe(true);
    expect(canAddMoney(viewOnly)).toBe(false);
    expect(canAddExpense(viewOnly)).toBe(false);
    expect(canSettle(viewOnly)).toBe(false);
    expect(canInvite(viewOnly)).toBe(false);
    expect(canManageMembers(viewOnly)).toBe(false);
    expect(canReviewJoinRequests(viewOnly)).toBe(false);
    const own = makeTx({ createdBy: 'mem_1' });
    expect(canEditTransaction(viewOnly, own)).toBe(false);
  });
});

describe('inactive (removed) member', () => {
  const removed = makeMember({ role: 'member', status: 'inactive' });
  it('cannot do anything', () => {
    expect(canAddMoney(removed)).toBe(false);
    expect(canManageMembers(removed)).toBe(false);
  });
});

describe('undefined member (not in this pot)', () => {
  it('cannot do anything', () => {
    expect(canAddMoney(undefined)).toBe(false);
    expect(canManageMembers(undefined)).toBe(false);
    expect(canEditTransaction(undefined, makeTx())).toBe(false);
  });
});
