import { buildPotSummaryFilename } from '@/logic/pot-summary-html';
import { buildPotSummaryViewModel } from '@/logic/pot-summary';
import type { Commitment, CommitmentPayment, Member, Pot, Transaction } from '@/types/models';

// The exact worked example from the Settle Up product spec / accounting.test.ts:
// Contributions Raj 4000, Sakshi 4000, Mona 3000, Sunil 5400 (total 16400).
// Pool expenses 7200 + 6000 + 2100 + 3500 (total 18800), split equally.
// Pool balance -2400. Member positions: Raj -700, Sakshi -700, Mona -1700, Sunil +700.
// Settlement plan: Raj -> Pool 700, Sakshi -> Pool 700, Mona -> Pool 1000, Mona -> Sunil 700.
function makeMembers(): Member[] {
  return [
    { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    { id: 'sakshi', name: 'Sakshi', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    { id: 'mona', name: 'Mona', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    { id: 'sunil', name: 'Sunil', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
  ];
}

function makePot(members: Member[], expectedContributionPerMember?: number | null): Pot {
  return {
    id: 'trip',
    name: 'Goa 2026',
    currency: 'INR',
    createdBy: 'raj',
    inviteCode: 'ABC123',
    inviteEnabled: true,
    joinCode: 'XYZ789',
    joinEnabled: true,
    expectedContributionPerMember: expectedContributionPerMember ?? null,
    status: 'active',
    createdAt: '2026-01-01',
    members,
  };
}

function makeTransactions(): Transaction[] {
  const members = makeMembers();
  const ids = members.map((m) => m.id);
  const contributions: [string, number][] = [
    ['raj', 400000],
    ['sakshi', 400000],
    ['mona', 300000],
    ['sunil', 540000],
  ];
  const txs: Transaction[] = contributions.map(([memberId, amount], i) => ({
    id: `contrib_${i}`,
    potId: 'trip',
    type: 'contribution',
    description: 'Trip contribution',
    amount,
    paidBy: memberId,
    date: '2026-01-01',
    createdAt: `2026-01-01T0${i}:00:00.000Z`,
    createdBy: memberId,
  }));

  const expenses: [string, number, string][] = [
    ['Cruise', 720000, 'Activities'],
    ['Flight', 600000, 'Transport'],
    ['Pre Booking Payment', 210000, 'Stay'],
    ['Stay Advance', 350000, 'Stay'],
  ];
  expenses.forEach(([description, amount, category], i) => {
    const base = Math.floor(amount / ids.length);
    const remainder = amount - base * ids.length;
    txs.push({
      id: `exp_${i}`,
      potId: 'trip',
      type: 'pool_expense',
      description,
      amount,
      category,
      paymentSource: 'pool',
      participants: ids,
      splits: ids.map((memberId, idx) => ({ memberId, amount: base + (idx < remainder ? 1 : 0) })),
      splitMethod: 'equal',
      date: `2026-01-0${i + 2}`,
      createdAt: `2026-01-0${i + 2}T0${i}:00:00.000Z`,
      createdBy: 'raj',
    });
  });

  return txs;
}

describe('buildPotSummaryViewModel: spec worked example', () => {
  const members = makeMembers();
  const pot = makePot(members);
  const txs = makeTransactions();
  const vm = buildPotSummaryViewModel(pot, txs, [], [], '2026-09-17T00:00:00.000Z');

  it('pool totals match the accounting engine exactly', () => {
    expect(vm.pool.contributed).toBe(1640000);
    expect(vm.pool.totalSpent).toBe(1880000);
    expect(vm.pool.balance).toBe(-240000);
    expect(vm.memberCount).toBe(4);
  });

  it('member contributions are aggregated by stable member id, one row per member, sorted by total desc', () => {
    expect(vm.contributions.total).toBe(1640000);
    expect(vm.contributions.members.map((m) => [m.memberId, m.total, m.count])).toEqual([
      ['sunil', 540000, 1],
      ['raj', 400000, 1],
      ['sakshi', 400000, 1],
      ['mona', 300000, 1],
    ]);
    // Distinct member ids — never collapsed by name.
    expect(new Set(vm.contributions.members.map((m) => m.memberId)).size).toBe(4);
  });

  it('expense summary/details are pool expenses only, grouped by category, summing back to the total', () => {
    expect(vm.expenses.total).toBe(1880000);
    const byCategory = Object.fromEntries(vm.expenses.categories.map((c) => [c.category, c.amount]));
    expect(byCategory).toEqual({ Activities: 720000, Transport: 600000, Stay: 560000 });
    expect(vm.expenses.categories.reduce((s, c) => s + c.amount, 0)).toBe(1880000);
    expect(vm.expenses.items).toHaveLength(4);
    // Sorted newest first.
    expect(vm.expenses.items[0].date >= vm.expenses.items[vm.expenses.items.length - 1].date).toBe(true);
  });

  it('member balances show every member by name, positive = gets, negative = owes, summing to the pool balance', () => {
    const byId = Object.fromEntries(vm.balances.map((b) => [b.memberId, b.balance]));
    expect(byId).toEqual({ raj: -70000, sakshi: -70000, mona: -170000, sunil: 70000 });
    expect(vm.balances.reduce((s, b) => s + b.balance, 0)).toBe(-240000);
  });

  it('settlement plan separates Pool Funding from Member Settlement without double-counting the deficit', () => {
    expect(vm.settlement.poolFunding).toEqual([
      { memberId: 'raj', name: 'Raj', amount: 70000 },
      { memberId: 'sakshi', name: 'Sakshi', amount: 70000 },
      { memberId: 'mona', name: 'Mona', amount: 100000 },
    ]);
    expect(vm.settlement.poolFundingTotal).toBe(240000);
    expect(vm.settlement.memberTransfers).toEqual([{ fromId: 'mona', fromName: 'Mona', toId: 'sunil', toName: 'Sunil', amount: 70000 }]);
    expect(vm.settlement.memberSettlementOutstanding).toBe(70000);
    // Pool funding total + member settlement total is never presented as a separate sum on top of the pool deficit.
    expect(vm.settlement.poolFundingTotal + vm.settlement.memberSettlementOutstanding).toBe(310000);
    expect(vm.settlement.allSettled).toBe(false);
  });

  it('pot status reflects the same underlying numbers, not an invented aggregate', () => {
    expect(vm.status.poolBalanced).toBe(false);
    expect(vm.status.poolShortfall).toBe(240000);
    expect(vm.status.settlementActionsRemaining).toBe(true);
  });
});

describe('buildPotSummaryViewModel: allSettled state', () => {
  it('reports allSettled once pool funding and member transfers are both recorded', () => {
    const members = makeMembers();
    const pot = makePot(members);
    // Simplest way to reach allSettled: fully fund the pool and clear the member debt directly.
    const settleTxs: Transaction[] = [
      ...makeTransactions(),
      { id: 'pf1', potId: 'trip', type: 'contribution', description: 'Pool top-up', amount: 70000, paidBy: 'raj', date: '2026-01-05', createdAt: '2026-01-05T00:00:00.000Z', createdBy: 'raj' },
      { id: 'pf2', potId: 'trip', type: 'contribution', description: 'Pool top-up', amount: 70000, paidBy: 'sakshi', date: '2026-01-05', createdAt: '2026-01-05T01:00:00.000Z', createdBy: 'sakshi' },
      { id: 'pf3', potId: 'trip', type: 'contribution', description: 'Pool top-up', amount: 100000, paidBy: 'mona', date: '2026-01-05', createdAt: '2026-01-05T02:00:00.000Z', createdBy: 'mona' },
      { id: 'mt1', potId: 'trip', type: 'settlement', description: 'Mona -> Sunil', amount: 70000, paidBy: 'mona', toMember: 'sunil', date: '2026-01-06', createdAt: '2026-01-06T00:00:00.000Z', createdBy: 'mona' },
    ];
    const vm = buildPotSummaryViewModel(pot, settleTxs, [], []);
    expect(vm.settlement.allSettled).toBe(true);
    expect(vm.status.poolBalanced).toBe(true);
    expect(vm.status.settlementActionsRemaining).toBe(false);
    expect(vm.balances.every((b) => b.balance === 0)).toBe(true);
  });
});

describe('buildPotSummaryViewModel: expected contribution / low-contribution highlighting', () => {
  const members = makeMembers();
  const txs = makeTransactions();

  it('never invents an expectation when the Pot has none configured', () => {
    const vm = buildPotSummaryViewModel(makePot(members, null), txs, [], []);
    expect(vm.contributions.expectedPerMember).toBeNull();
    expect(vm.contributions.members.every((m) => m.expectation.status === 'none')).toBe(true);
  });

  it('flags below/on-track/above/no-contribution against the configured expectation, never Total / N', () => {
    // Expected per member 400000 (₹4,000) — deliberately NOT total(1640000)/4=410000, to prove it's not derived from the total.
    const vm = buildPotSummaryViewModel(makePot(members, 400000), txs, [], []);
    expect(vm.contributions.expectedPerMember).toBe(400000);
    const byId = Object.fromEntries(vm.contributions.members.map((m) => [m.memberId, m.expectation]));
    expect(byId.raj.status).toBe('on_track');
    expect(byId.sakshi.status).toBe('on_track');
    expect(byId.mona.status).toBe('below');
    expect(byId.mona.difference).toBe(-100000);
    expect(byId.sunil.status).toBe('above');
  });

  it('flags "no contribution yet" for a member with zero contributions', () => {
    const zeroMember: Member = { id: 'manoj', name: 'Manoj', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' };
    const withZero = [...members, zeroMember];
    const vm = buildPotSummaryViewModel(makePot(withZero, 200000), txs, [], []);
    const manoj = vm.contributions.members.find((m) => m.memberId === 'manoj')!;
    expect(manoj.count).toBe(0);
    expect(manoj.expectation.status).toBe('below');
  });
});

describe('buildPotSummaryViewModel: multiple contributions and duplicate display names', () => {
  it('aggregates multiple contribution transactions for the same member into one row', () => {
    const members = makeMembers();
    const pot = makePot(members);
    const txs: Transaction[] = [
      { id: 't1', potId: 'trip', type: 'contribution', description: 'x', amount: 100000, paidBy: 'raj', date: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'raj' },
      { id: 't2', potId: 'trip', type: 'contribution', description: 'x', amount: 150000, paidBy: 'raj', date: '2026-01-02', createdAt: '2026-01-02T00:00:00.000Z', createdBy: 'raj' },
      { id: 't3', potId: 'trip', type: 'contribution', description: 'x', amount: 50000, paidBy: 'raj', date: '2026-01-03', createdAt: '2026-01-03T00:00:00.000Z', createdBy: 'raj' },
    ];
    const vm = buildPotSummaryViewModel(pot, txs, [], []);
    const raj = vm.contributions.members.find((m) => m.memberId === 'raj')!;
    expect(raj.total).toBe(300000);
    expect(raj.count).toBe(3);
    // Every active member still gets exactly one row each (Sakshi/Mona/Sunil at zero) — Raj's three transactions collapse into his single row.
    expect(vm.contributions.members).toHaveLength(4);
    expect(vm.contributions.members.filter((m) => m.memberId === 'raj')).toHaveLength(1);
  });

  it('groups strictly by pot_member_id, never by display name, when two members share a name', () => {
    const dup: Member[] = [
      { id: 'raj1', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'raj2', name: 'Raj', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const pot = makePot(dup);
    const txs: Transaction[] = [
      { id: 't1', potId: 'trip', type: 'contribution', description: 'x', amount: 100000, paidBy: 'raj1', date: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'raj1' },
      { id: 't2', potId: 'trip', type: 'contribution', description: 'x', amount: 200000, paidBy: 'raj2', date: '2026-01-01', createdAt: '2026-01-01T01:00:00.000Z', createdBy: 'raj2' },
    ];
    const vm = buildPotSummaryViewModel(pot, txs, [], []);
    expect(vm.contributions.members).toHaveLength(2);
    expect(vm.contributions.members.map((m) => m.memberId).sort()).toEqual(['raj1', 'raj2']);
    expect(vm.contributions.total).toBe(300000);
  });
});

describe('buildPotSummaryViewModel: Upcoming Payments isolation', () => {
  it('never lets a Commitment affect Total Spent, Pool Balance, or Settlement', () => {
    const members = makeMembers();
    const pot = makePot(members);
    const txs = makeTransactions();
    const commitments: Commitment[] = [
      {
        id: 'cmt1',
        potId: 'trip',
        title: 'Hotel',
        vendorName: 'Calux Hotel Resorts',
        totalAmount: 4200000,
        dueDate: '2026-09-20',
        status: 'planned',
        createdBy: 'raj',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    // Partial payment recorded as a real member-paid expense, linked via CommitmentPayment.
    const paymentTx: Transaction = {
      id: 'hotel_pay',
      potId: 'trip',
      type: 'member_expense',
      description: 'Hotel advance',
      amount: 2000000,
      paidBy: 'raj',
      paymentSource: 'personal',
      participants: members.map((m) => m.id),
      splits: members.map((m) => ({ memberId: m.id, amount: 500000 })),
      splitMethod: 'equal',
      date: '2026-01-05',
      createdAt: '2026-01-05T00:00:00.000Z',
      createdBy: 'raj',
    };
    const payments: CommitmentPayment[] = [
      { id: 'cpay1', potId: 'trip', commitmentId: 'cmt1', transactionId: 'hotel_pay', amount: 2000000, createdAt: '2026-01-05T00:00:00.000Z' },
    ];

    const vmWithoutCommitment = buildPotSummaryViewModel(pot, txs, [], []);
    const vmWithCommitment = buildPotSummaryViewModel(pot, [...txs, paymentTx], commitments, payments);

    // Pool balance/spent/contributed only reflect the linked transaction's own type — a member_expense never touches the pool.
    expect(vmWithCommitment.pool.balance).toBe(vmWithoutCommitment.pool.balance);
    expect(vmWithCommitment.expenses.total).toBe(vmWithoutCommitment.expenses.total);

    expect(vmWithCommitment.upcoming.totalRemaining).toBe(2200000);
    expect(vmWithCommitment.upcoming.items).toEqual([
      expect.objectContaining({ id: 'cmt1', paid: 2000000, remaining: 2200000, status: 'partially_paid' }),
    ]);
  });
});

describe('buildPotSummaryFilename', () => {
  it('sanitizes the pot name into a meaningful, filesystem-safe filename', () => {
    expect(buildPotSummaryFilename('Goa 2026')).toBe('Potto_Goa_2026_Summary.pdf');
    expect(buildPotSummaryFilename('Trip: Manali / 2027?')).toBe('Potto_Trip_Manali_2027_Summary.pdf');
    expect(buildPotSummaryFilename('')).toBe('Potto_Pot_Summary.pdf');
  });
});
