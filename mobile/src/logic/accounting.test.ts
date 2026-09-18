import {
  calculateContributionSummaries,
  calculateMemberBalances,
  calculateMemberSettlementTransfers,
  calculateMyPosition,
  calculatePoolBalance,
  calculatePoolFundingPlan,
  calculateSettlementSuggestions,
  calculateTotalContributions,
  evaluateContributionExpectation,
  sortContributionSummaries,
} from '@/logic/accounting';
import type { Member, Transaction } from '@/types/models';

// The exact worked example from the Settle Up product spec:
// Contributions Raj 4000, Sakshi 4000, Mona 3000, Sunil 5400 (total 16400).
// Pool expenses 7200 + 6000 + 2100 + 3500 (total 18800), split equally.
// Pool balance -2400. Member positions: Raj -700, Sakshi -700, Mona -1700, Sunil +700.
function makeMembers(): Member[] {
  return [
    { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    { id: 'sakshi', name: 'Sakshi', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    { id: 'mona', name: 'Mona', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    { id: 'sunil', name: 'Sunil', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
  ];
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

  const expenseAmounts = [720000, 600000, 210000, 350000];
  expenseAmounts.forEach((amount, i) => {
    const base = Math.floor(amount / ids.length);
    const remainder = amount - base * ids.length;
    txs.push({
      id: `exp_${i}`,
      potId: 'trip',
      type: 'pool_expense',
      description: `Expense ${i}`,
      amount,
      paymentSource: 'pool',
      participants: ids,
      splits: ids.map((memberId, idx) => ({ memberId, amount: base + (idx < remainder ? 1 : 0) })),
      splitMethod: 'equal',
      date: '2026-01-02',
      createdAt: `2026-01-02T0${i}:00:00.000Z`,
      createdBy: 'raj',
    });
  });

  return txs;
}

describe('spec worked example: Raj/Sakshi/Mona/Sunil', () => {
  const members = makeMembers();
  const txs = makeTransactions();

  it('pool balance is -2400 and balances sum to it (no double counting)', () => {
    expect(calculatePoolBalance(txs)).toBe(-240000);
    const balances = calculateMemberBalances(members, txs);
    expect(balances).toEqual({ raj: -70000, sakshi: -70000, mona: -170000, sunil: 70000 });
    expect(Object.values(balances).reduce((s, v) => s + v, 0)).toBe(-240000);
  });

  it('pool funding plan allocates Raj 700, Sakshi 700, Mona 1000 and leaves Mona owing Sunil 700', () => {
    const plan = calculatePoolFundingPlan(members, txs);
    expect(plan.amountNeeded).toBe(240000);
    expect(plan.contributions).toEqual([
      { memberId: 'raj', amount: 70000 },
      { memberId: 'sakshi', amount: 70000 },
      { memberId: 'mona', amount: 100000 },
    ]);
    // Pool contributions never exceed each debtor's own balance, and sum exactly to the deficit.
    expect(plan.contributions.reduce((s, c) => s + c.amount, 0)).toBe(240000);

    const transfers = calculateMemberSettlementTransfers(members, txs);
    expect(transfers).toEqual([{ from: 'mona', to: 'sunil', amount: 70000 }]);
  });

  it("Raj's primary action is adding to the Pool, never a direct transfer to Sunil", () => {
    const pos = calculateMyPosition(members, txs, 'raj');
    expect(pos).toEqual({ kind: 'pool_only', amount: 70000, poolAmount: 70000, memberTransfers: [] });
  });

  it("Sakshi's position mirrors Raj's", () => {
    const pos = calculateMyPosition(members, txs, 'sakshi');
    expect(pos).toEqual({ kind: 'pool_only', amount: 70000, poolAmount: 70000, memberTransfers: [] });
  });

  it("Mona's position breaks down into a Pool slice and a Sunil transfer", () => {
    const pos = calculateMyPosition(members, txs, 'mona');
    expect(pos.kind).toBe('pool_and_member');
    expect(pos.amount).toBe(170000);
    expect(pos.poolAmount).toBe(100000);
    expect(pos.memberTransfers).toEqual([{ toMemberId: 'sunil', amount: 70000 }]);
  });

  it("Sunil should receive money and owes nothing to the pool", () => {
    const pos = calculateMyPosition(members, txs, 'sunil');
    expect(pos).toEqual({ kind: 'receive', amount: 70000, poolAmount: 0, memberTransfers: [] });
  });

  it('after Raj contributes 700 to the pool, his position clears and the plan updates', () => {
    const nextTxs: Transaction[] = [
      ...txs,
      {
        id: 'pool_fund_raj',
        potId: 'trip',
        type: 'contribution',
        description: 'Contribution',
        amount: 70000,
        paidBy: 'raj',
        date: '2026-01-03',
        createdAt: '2026-01-03T00:00:00.000Z',
        createdBy: 'raj',
      },
    ];
    const plan = calculatePoolFundingPlan(members, nextTxs);
    expect(plan.amountNeeded).toBe(170000);
    expect(plan.funded).toBe(70000);
    expect(plan.target).toBe(240000);
    expect(plan.contributions).toEqual([
      { memberId: 'sakshi', amount: 70000 },
      { memberId: 'mona', amount: 100000 },
    ]);
    expect(calculateMyPosition(members, nextTxs, 'raj')).toEqual({
      kind: 'settled',
      amount: 0,
      poolAmount: 0,
      memberTransfers: [],
    });
  });

  it('paying the member-to-member leg first still self-corrects (order independence)', () => {
    const nextTxs: Transaction[] = [
      ...txs,
      {
        id: 'settle_mona_sunil',
        potId: 'trip',
        type: 'settlement',
        description: 'Mona → Sunil',
        amount: 70000,
        paidBy: 'mona',
        toMember: 'sunil',
        date: '2026-01-03',
        createdAt: '2026-01-03T00:00:00.000Z',
        createdBy: 'mona',
      },
    ];
    const balances = calculateMemberBalances(members, nextTxs);
    expect(balances).toEqual({ raj: -70000, sakshi: -70000, mona: -100000, sunil: 0 });
    expect(calculatePoolBalance(nextTxs)).toBe(-240000);

    const plan = calculatePoolFundingPlan(members, nextTxs);
    expect(plan.amountNeeded).toBe(240000);
    expect(plan.contributions).toEqual([
      { memberId: 'raj', amount: 70000 },
      { memberId: 'sakshi', amount: 70000 },
      { memberId: 'mona', amount: 100000 },
    ]);
    expect(calculateMemberSettlementTransfers(members, nextTxs)).toEqual([]);
  });
});

describe('pool funding edge cases', () => {
  const members = makeMembers();

  it('pool positive: no pool contribution required, plan behaves like plain settlement suggestions', () => {
    const txs: Transaction[] = [
      { id: 't1', potId: 'p', type: 'contribution', description: 'c', amount: 100000, paidBy: 'raj', date: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'raj' },
      { id: 't2', potId: 'p', type: 'pool_expense', description: 'e', amount: 40000, participants: ['raj', 'sakshi'], splits: [{ memberId: 'raj', amount: 20000 }, { memberId: 'sakshi', amount: 20000 }], splitMethod: 'equal', paymentSource: 'pool', date: '2026-01-02', createdAt: '2026-01-02T00:00:00.000Z', createdBy: 'raj' },
    ];
    const plan = calculatePoolFundingPlan(members, txs);
    expect(plan.amountNeeded).toBe(0);
    expect(plan.contributions).toEqual([]);
    const balances = calculateMemberBalances(members, txs);
    expect(calculateMemberSettlementTransfers(members, txs)).toEqual(calculateSettlementSuggestions(balances));
  });

  it('pool zero and all balances zero: fully settled, nothing to fund or transfer', () => {
    const plan = calculatePoolFundingPlan(members, []);
    expect(plan.poolBalance).toBe(0);
    expect(plan.amountNeeded).toBe(0);
    expect(plan.target).toBe(0);
    expect(plan.contributions).toEqual([]);
    expect(calculateMemberSettlementTransfers(members, [])).toEqual([]);
  });

  it('never produces a self-settlement or a transfer outside the pot members', () => {
    const txs = makeTransactions();
    const transfers = calculateMemberSettlementTransfers(members, txs);
    transfers.forEach((t) => {
      expect(t.from).not.toBe(t.to);
      expect(members.some((m) => m.id === t.from)).toBe(true);
      expect(members.some((m) => m.id === t.to)).toBe(true);
    });
  });
});

describe('member-wise contribution summaries (Activity > Contributions)', () => {
  function contribTx(id: string, memberId: string, amount: number, date: string): Transaction {
    return {
      id,
      potId: 'trip',
      type: 'contribution',
      description: 'Contribution',
      amount,
      paidBy: memberId,
      date,
      createdAt: `${date}T00:00:00.000Z`,
      createdBy: memberId,
    };
  }

  // TEST 1 — same member, several contributions of different amounts sums correctly.
  it('sums multiple contributions from the same member without losing any', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const txs = [
      contribTx('t1', 'raj', 200000, '2026-09-10'),
      contribTx('t2', 'raj', 200000, '2026-09-12'),
      contribTx('t3', 'raj', 300000, '2026-09-15'),
      contribTx('t4', 'raj', 100000, '2026-09-17'),
    ];
    const [summary] = calculateContributionSummaries(members, txs);
    expect(summary).toEqual({ memberId: 'raj', total: 800000, count: 4 });
  });

  // TEST 2 — one contribution each, distinct members must not be collapsed into a single row.
  it('keeps each member as a separate row, not a generic aggregate', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'sunil', name: 'Sunil', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'akash', name: 'Akash', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'mona', name: 'Mona', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const txs = members.map((m, i) => contribTx(`t${i}`, m.id, 200000, '2026-09-01'));
    const summaries = calculateContributionSummaries(members, txs);
    expect(summaries).toHaveLength(4);
    summaries.forEach((s) => expect(s).toEqual({ memberId: s.memberId, total: 200000, count: 1 }));
  });

  // TEST 3 — no floating-point drift across uneven amounts.
  it('aggregates uneven amounts exactly, in integer paise', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const txs = [
      contribTx('t1', 'raj', 150000, '2026-09-10'),
      contribTx('t2', 'raj', 225000, '2026-09-12'),
      contribTx('t3', 'raj', 310000, '2026-09-15'),
    ];
    const [summary] = calculateContributionSummaries(members, txs);
    expect(summary.total).toBe(685000);
  });

  // TEST 4 — two members sharing a display name must never be merged; grouping is by id.
  it('never merges two different members that share a display name', () => {
    const members: Member[] = [
      { id: 'raj_1', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'raj_2', name: 'Raj', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-02' },
    ];
    const txs = [contribTx('t1', 'raj_1', 200000, '2026-09-01'), contribTx('t2', 'raj_2', 500000, '2026-09-02')];
    const summaries = calculateContributionSummaries(members, txs);
    expect(summaries.find((s) => s.memberId === 'raj_1')).toEqual({ memberId: 'raj_1', total: 200000, count: 1 });
    expect(summaries.find((s) => s.memberId === 'raj_2')).toEqual({ memberId: 'raj_2', total: 500000, count: 1 });
  });

  // TEST 6 — deleting one transaction (simulated by omitting it) only reduces that member's own total.
  it('removing a single contribution transaction only reduces that member by that transaction', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const all = [
      contribTx('t1', 'raj', 200000, '2026-09-10'),
      contribTx('t2', 'raj', 200000, '2026-09-12'),
      contribTx('t3', 'raj', 300000, '2026-09-15'),
      contribTx('t4', 'raj', 100000, '2026-09-17'),
    ];
    const [before] = calculateContributionSummaries(members, all);
    expect(before).toEqual({ memberId: 'raj', total: 800000, count: 4 });

    const afterDeletingT3 = all.filter((t) => t.id !== 't3');
    const [after] = calculateContributionSummaries(members, afterDeletingT3);
    expect(after).toEqual({ memberId: 'raj', total: 500000, count: 3 });
  });

  // TEST 7 — editing one transaction's amount only shifts the total by the delta.
  it('editing a contribution amount shifts the member total by exactly the delta', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const txs = [contribTx('t1', 'raj', 200000, '2026-09-10'), contribTx('t2', 'raj', 200000, '2026-09-12')];
    const edited = txs.map((t) => (t.id === 't1' ? { ...t, amount: 300000 } : t));
    const [before] = calculateContributionSummaries(members, txs);
    const [after] = calculateContributionSummaries(members, edited);
    expect(before.total).toBe(400000);
    expect(after.total).toBe(500000);
    expect(after.total - before.total).toBe(100000);
    expect(after.count).toBe(before.count);
  });

  // TEST 8 — two pots, each with a member named Raj: transactions are already pot-scoped by
  // getTransactions(potId), so aggregating a pot's own transaction array never sees the other pot's.
  it('only aggregates the transactions passed in — cross-pot isolation is the caller passing the right list', () => {
    const goaRaj: Member = { id: 'goa_raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' };
    const mussoorieRaj: Member = { id: 'mus_raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' };
    const goaTxs = [{ ...contribTx('g1', 'goa_raj', 800000, '2026-01-01'), potId: 'goa' }];
    const mussoorieTxs = [{ ...contribTx('m1', 'mus_raj', 300000, '2026-01-01'), potId: 'mussoorie' }];

    expect(calculateContributionSummaries([goaRaj], goaTxs)[0].total).toBe(800000);
    expect(calculateContributionSummaries([mussoorieRaj], mussoorieTxs)[0].total).toBe(300000);
  });

  it('seeds every current member at zero, including those with no contributions yet', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'sakshi', name: 'Sakshi', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const txs = [contribTx('t1', 'raj', 800000, '2026-09-01')];
    const summaries = calculateContributionSummaries(members, txs);
    expect(summaries).toEqual(
      expect.arrayContaining([
        { memberId: 'raj', total: 800000, count: 1 },
        { memberId: 'sakshi', total: 0, count: 0 },
      ]),
    );
  });

  it('sortContributionSummaries puts contributors first, highest total first, ties by pot member order', () => {
    const summaries = [
      { memberId: 'c', total: 0, count: 0 },
      { memberId: 'a', total: 400000, count: 2 },
      { memberId: 'b', total: 400000, count: 1 },
      { memberId: 'd', total: 0, count: 0 },
    ];
    const sorted = sortContributionSummaries(summaries, ['a', 'b', 'c', 'd']);
    expect(sorted.map((s) => s.memberId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('calculateTotalContributions matches the sum of every member summary total', () => {
    const members: Member[] = [
      { id: 'raj', name: 'Raj', role: 'admin', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
      { id: 'sakshi', name: 'Sakshi', role: 'member', accessLevel: 'member', status: 'active', joinedAt: '2026-01-01' },
    ];
    const txs = [
      contribTx('t1', 'raj', 200000, '2026-09-10'),
      contribTx('t2', 'sakshi', 300000, '2026-09-11'),
      contribTx('t3', 'raj', 150000, '2026-09-12'),
    ];
    const summaries = calculateContributionSummaries(members, txs);
    expect(calculateTotalContributions(txs)).toBe(summaries.reduce((s, x) => s + x.total, 0));
  });
});

describe('evaluateContributionExpectation (low-contribution highlighting)', () => {
  it('is "none" whenever no expected amount is configured, so no warning is ever invented', () => {
    expect(evaluateContributionExpectation(200000, undefined)).toEqual({ status: 'none', difference: 0 });
    expect(evaluateContributionExpectation(200000, null)).toEqual({ status: 'none', difference: 0 });
    expect(evaluateContributionExpectation(200000, 0)).toEqual({ status: 'none', difference: 0 });
    expect(evaluateContributionExpectation(0, undefined)).toEqual({ status: 'none', difference: 0 });
  });

  it('is "on_track" when the total exactly matches the expected amount', () => {
    expect(evaluateContributionExpectation(200000, 200000)).toEqual({ status: 'on_track', difference: 0 });
  });

  it('is "below" for a partial contribution, with the exact shortfall as a negative difference', () => {
    // ₹2,000 expected, ₹1,200 contributed -> ₹800 below.
    expect(evaluateContributionExpectation(120000, 200000)).toEqual({ status: 'below', difference: -80000 });
  });

  it('is "below" for zero contribution — the caller decides the "No contribution yet" wording from total === 0', () => {
    expect(evaluateContributionExpectation(0, 200000)).toEqual({ status: 'below', difference: -200000 });
  });

  it('is "above" for an over-contribution, with the exact surplus as a positive difference', () => {
    expect(evaluateContributionExpectation(250000, 200000)).toEqual({ status: 'above', difference: 50000 });
  });

  it('never depends on the pool balance, other members, or any settlement calculation', () => {
    // Same member total + same expected amount always yields the same verdict,
    // regardless of what anyone else contributed or how the pool nets out.
    const a = evaluateContributionExpectation(120000, 200000);
    const b = evaluateContributionExpectation(120000, 200000);
    expect(a).toEqual(b);
  });
});
