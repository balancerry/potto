import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  calculatePotentialShortfall,
  calculateTotalUpcomingRemaining,
  deriveCommitmentStatus,
  deriveDueDateState,
  validateCommitmentPaymentAmount,
  validateCommitmentTotalAmount,
} from '@/logic/commitments';
import type { Commitment, CommitmentPayment, Transaction } from '@/types/models';

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'cmt_1',
    potId: 'pot_1',
    title: 'Hotel',
    vendorName: 'Sea View Resort',
    totalAmount: 4_200_000, // ₹42,000
    status: 'planned',
    createdBy: 'mem_1',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_1',
    potId: 'pot_1',
    type: 'pool_expense',
    description: 'Hotel',
    amount: 100,
    date: '2026-09-17',
    createdAt: '2026-09-17T00:00:00.000Z',
    createdBy: 'mem_1',
    ...overrides,
  };
}

function makePayment(overrides: Partial<CommitmentPayment> = {}): CommitmentPayment {
  return {
    id: 'cpay_1',
    potId: 'pot_1',
    commitmentId: 'cmt_1',
    transactionId: 'tx_1',
    amount: 100,
    createdAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('the complete hotel verification scenario (spec section 34)', () => {
  it('creating the commitment alone leaves paid at 0 and remaining at the full total', () => {
    const commitment = makeCommitment();
    expect(calculateCommitmentPaid(commitment.id, [], [])).toBe(0);
    expect(calculateCommitmentRemaining(commitment, [], [])).toBe(4_200_000);
    expect(deriveCommitmentStatus(commitment, 0)).toBe('planned');
  });

  it('Raj personally paying ₹20,000 (member_expense) brings paid to 20,000 / remaining to 22,000', () => {
    const commitment = makeCommitment();
    const memberTx = makeTx({ id: 'tx_member', type: 'member_expense', amount: 2_000_000, paidBy: 'raj' });
    const payments = [makePayment({ id: 'cpay_member', transactionId: 'tx_member', amount: 2_000_000 })];
    const transactions = [memberTx];

    const paid = calculateCommitmentPaid(commitment.id, payments, transactions);
    expect(paid).toBe(2_000_000);
    expect(calculateCommitmentRemaining(commitment, payments, transactions)).toBe(2_200_000);
    expect(deriveCommitmentStatus(commitment, paid)).toBe('partially_paid');
  });

  it('the Pot then paying the remaining ₹22,000 (pool_expense) brings it to fully paid with exactly two transactions', () => {
    const commitment = makeCommitment();
    const memberTx = makeTx({ id: 'tx_member', type: 'member_expense', amount: 2_000_000, paidBy: 'raj' });
    const poolTx = makeTx({ id: 'tx_pool', type: 'pool_expense', amount: 2_200_000 });
    const transactions = [memberTx, poolTx];
    const payments = [
      makePayment({ id: 'cpay_member', transactionId: 'tx_member', amount: 2_000_000 }),
      makePayment({ id: 'cpay_pool', transactionId: 'tx_pool', amount: 2_200_000 }),
    ];

    const paid = calculateCommitmentPaid(commitment.id, payments, transactions);
    expect(paid).toBe(4_200_000);
    expect(calculateCommitmentRemaining(commitment, payments, transactions)).toBe(0);
    expect(deriveCommitmentStatus(commitment, paid)).toBe('fully_paid');
    // Exactly two actual transactions — never a third ₹42,000 transaction for the commitment itself.
    expect(transactions).toHaveLength(2);
    expect(transactions.reduce((s, t) => s + t.amount, 0)).toBe(4_200_000);
  });
});

describe('deleting a linked transaction (spec section 27)', () => {
  it('paid drops back to 0 and remaining returns to the full total once the transaction no longer exists', () => {
    const commitment = makeCommitment();
    const payments = [makePayment({ transactionId: 'tx_deleted', amount: 2_000_000 })];
    // The transaction has been deleted — it's simply absent from the live list,
    // exactly as PottoStore.deleteTransaction leaves it.
    const transactions: Transaction[] = [];

    expect(calculateCommitmentPaid(commitment.id, payments, transactions)).toBe(0);
    expect(calculateCommitmentRemaining(commitment, payments, transactions)).toBe(4_200_000);
    expect(deriveCommitmentStatus(commitment, 0)).toBe('planned');
  });

  it('editing a linked transaction amount changes paid to match the new amount', () => {
    const commitment = makeCommitment();
    const tx = makeTx({ id: 'tx_1', amount: 2_000_000 });
    const payments = [makePayment({ transactionId: 'tx_1', amount: 2_000_000 })];
    expect(calculateCommitmentPaid(commitment.id, payments, [tx])).toBe(2_000_000);

    const editedTx = { ...tx, amount: 1_000_000 };
    expect(calculateCommitmentPaid(commitment.id, payments, [editedTx])).toBe(1_000_000);
  });
});

describe('cancellation', () => {
  it('cancelled status always wins regardless of paid amount', () => {
    const commitment = makeCommitment({ status: 'cancelled' });
    expect(deriveCommitmentStatus(commitment, 0)).toBe('cancelled');
    expect(deriveCommitmentStatus(commitment, 2_000_000)).toBe('cancelled');
  });

  it('cancelling does not remove historical payments/transactions from the calculation', () => {
    const commitment = makeCommitment({ status: 'cancelled' });
    const tx = makeTx({ amount: 2_000_000 });
    const payments = [makePayment({ transactionId: tx.id, amount: 2_000_000 })];
    expect(calculateCommitmentPaid(commitment.id, payments, [tx])).toBe(2_000_000);
  });
});

describe('overpayment prevention (spec section 23)', () => {
  it('rejects a payment larger than the remaining amount, with the exact overage in the message', () => {
    const result = validateCommitmentPaymentAmount(200_000, 500_000); // remaining ₹2,000, tries ₹5,000
    expect(result.valid).toBe(false);
    expect(result.error).toContain('₹3,000');
  });

  it('accepts a payment exactly equal to the remaining amount', () => {
    expect(validateCommitmentPaymentAmount(200_000, 200_000).valid).toBe(true);
  });

  it('rejects zero, negative, and non-finite amounts', () => {
    expect(validateCommitmentPaymentAmount(200_000, 0).valid).toBe(false);
    expect(validateCommitmentPaymentAmount(200_000, -100).valid).toBe(false);
    expect(validateCommitmentPaymentAmount(200_000, NaN).valid).toBe(false);
  });
});

describe('validateCommitmentTotalAmount', () => {
  it('requires a positive finite total', () => {
    expect(validateCommitmentTotalAmount(100).valid).toBe(true);
    expect(validateCommitmentTotalAmount(0).valid).toBe(false);
    expect(validateCommitmentTotalAmount(-1).valid).toBe(false);
  });
});

describe('due date state derivation (spec section 18)', () => {
  const today = '2026-09-17';

  it('derives paid/cancelled from status first, ignoring the due date', () => {
    const commitment = makeCommitment({ dueDate: '2020-01-01' });
    expect(deriveDueDateState(commitment, 'fully_paid', today)).toBe('paid');
    expect(deriveDueDateState({ ...commitment, status: 'cancelled' }, 'cancelled', today)).toBe('cancelled');
  });

  it('has no due date', () => {
    expect(deriveDueDateState(makeCommitment({ dueDate: undefined }), 'planned', today)).toBe('no_due_date');
  });

  it('overdue, due today, due soon, and upcoming', () => {
    expect(deriveDueDateState(makeCommitment({ dueDate: '2026-09-10' }), 'planned', today)).toBe('overdue');
    expect(deriveDueDateState(makeCommitment({ dueDate: '2026-09-17' }), 'planned', today)).toBe('due_today');
    expect(deriveDueDateState(makeCommitment({ dueDate: '2026-09-19' }), 'planned', today)).toBe('due_soon');
    expect(deriveDueDateState(makeCommitment({ dueDate: '2026-10-01' }), 'planned', today)).toBe('upcoming');
  });
});

describe('dashboard aggregates (spec sections 16-17)', () => {
  it('sums remaining across non-cancelled commitments and excludes cancelled ones', () => {
    const active = makeCommitment({ id: 'a', totalAmount: 4_200_000 });
    const cancelled = makeCommitment({ id: 'b', totalAmount: 800_000, status: 'cancelled' });
    const total = calculateTotalUpcomingRemaining([active, cancelled], [], []);
    expect(total).toBe(4_200_000);
  });

  it('derives a potential shortfall only when upcoming remaining exceeds the pool balance', () => {
    expect(calculatePotentialShortfall(3_000_000, 5_500_000)).toBe(2_500_000);
    expect(calculatePotentialShortfall(6_000_000, 5_500_000)).toBe(0);
  });
});
