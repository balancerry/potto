import { getPotNextAction } from '@/logic/next-up';
import type { Commitment, Member, Transaction } from '@/types/models';

function member(id: string): Member {
  return { id, name: id, role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-09-01' };
}

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount'>): Transaction {
  return {
    potId: 'p',
    description: partial.type,
    date: '2026-09-25',
    createdAt: '2026-09-25T00:00:00.000Z',
    createdBy: 'a',
    ...partial,
  };
}

function commitment(partial: Partial<Commitment> & Pick<Commitment, 'id' | 'totalAmount'>): Commitment {
  return {
    potId: 'p',
    title: 'Hotel',
    status: 'planned',
    createdBy: 'a',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

const today = '2026-09-28';

describe('getPotNextAction', () => {
  const members = [member('a'), member('b')];

  it('gets a brand-new pot started with a single contribution action', () => {
    const next = getPotNextAction({ members, transactions: [], commitments: [], commitmentPayments: [], todayISO: today });
    expect(next.type).toBe('collect_contributions');
    expect(next.title).toBe('Get your group started');
    expect(next.target).toBe('add_contribution');
    expect(next.primaryLabel).toBe('Add contribution');
    expect(next.secondaryTarget).toBeUndefined();
  });

  it('switches to viewing contributions once someone has paid in', () => {
    const next = getPotNextAction({
      members,
      transactions: [tx({ id: 'c1', type: 'contribution', amount: 500000, paidBy: 'a' })],
      commitments: [],
      commitmentPayments: [],
      expectedContributionPerMember: 500000,
      todayISO: today,
    });
    expect(next.type).toBe('collect_contributions');
    expect(next.target).toBe('add_contribution');
    expect(next.primaryLabel).toBe('Add contribution');
    expect(next.amountPaise).toBe(500000);
    expect(next.description).toBe("1 of 2 members haven't contributed yet.");
  });

  it('puts a due payment ahead of unfinished contributions when the pool can cover it', () => {
    const next = getPotNextAction({
      members,
      transactions: [tx({ id: 'c1', type: 'contribution', amount: 3_000_000, paidBy: 'a' })],
      commitments: [commitment({ id: 'h', totalAmount: 2_200_000, dueDate: '2026-09-29', title: 'Hotel payment' })],
      commitmentPayments: [],
      todayISO: today,
    });
    expect(next.type).toBe('record_payment');
    expect(next.title).toBe('Payment coming up');
    expect(next.primaryLabel).toBe('View payment');
    expect(next.description).toBe('Hotel payment is due tomorrow.');
    expect(next.commitmentId).toBe('h');
  });

  it('asks to balance the pool when planned payments exceed the pool', () => {
    const next = getPotNextAction({
      members,
      transactions: [tx({ id: 'c1', type: 'contribution', amount: 100000, paidBy: 'a' })],
      commitments: [commitment({ id: 'h', totalAmount: 950000, dueDate: '2026-10-20' })],
      commitmentPayments: [],
      todayISO: today,
    });
    expect(next.type).toBe('balance_pool');
    expect(next.amountPaise).toBe(850000);
    expect(next.title).toBe('Top up the Pot');
    expect(next.target).toBe('add_contribution');
  });

  it('asks the group to settle only after expenses create a debt', () => {
    const next = getPotNextAction({
      members,
      transactions: [
        tx({ id: 'c1', type: 'contribution', amount: 10000, paidBy: 'a' }),
        tx({ id: 'c2', type: 'contribution', amount: 10000, paidBy: 'b' }),
        tx({
          id: 'e1',
          type: 'member_expense',
          amount: 100000,
          paidBy: 'a',
          paymentSource: 'personal',
          splits: [
            { memberId: 'a', amount: 50000 },
            { memberId: 'b', amount: 50000 },
          ],
        }),
      ],
      commitments: [],
      commitmentPayments: [],
      todayISO: today,
    });
    expect(next.type).toBe('settle_members');
    expect(next.title).toBe('Settle up');
    expect(next.target).toBe('settle');
  });

  it('says the pot is up to date when everyone has contributed and nothing is open', () => {
    const next = getPotNextAction({
      members: [member('a')],
      transactions: [tx({ id: 'c1', type: 'contribution', amount: 10000, paidBy: 'a' })],
      commitments: [],
      commitmentPayments: [],
      todayISO: today,
    });
    expect(next.type).toBe('complete');
    expect(next.title).toBe("You're all set");
    expect(next.description).toBe('Nothing needs your attention right now.');
  });
});
