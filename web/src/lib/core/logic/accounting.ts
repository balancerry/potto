import type { Member, SettlementTransfer, Split, SplitMethod, Transaction } from '@/types/models';

/**
 * Pure, DOM/UI-free accounting engine for a single pot's ledger.
 * All money values are integer paise. Never use floating point for money.
 *
 * Accounting rules (see TRIP_WALLET_PRODUCT_SPEC.md section 32):
 * 1. Contribution increases pool.
 * 2. Pool expense decreases pool.
 * 3. Member-paid group expense does not automatically decrease pool.
 * 4. A member-paid expense increases the payer's credit.
 * 5. Every group expense must have participants.
 * 6. Participant shares must equal the total expense.
 * 7. Personal expenses must not affect group balances (not in MVP scope).
 * 8. Settlements are transfers, not expenses.
 * 9. One pot's transactions never affect another pot.
 * 10. All financial calculations must be deterministic.
 */

/** Pool Balance = Contributions - Pool Expenses (+ refunds if/when supported). */
export function calculatePoolBalance(transactions: Transaction[]): number {
  return transactions.reduce((total, t) => {
    if (t.type === 'contribution') return total + t.amount;
    if (t.type === 'pool_expense') return total - t.amount;
    return total;
  }, 0);
}

export function calculateTotalContributions(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === 'contribution').reduce((s, t) => s + t.amount, 0);
}

/** Total money the group has consumed: pool expenses + member-paid expenses. */
export function calculateTotalSpent(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'pool_expense' || t.type === 'member_expense')
    .reduce((s, t) => s + t.amount, 0);
}

export function calculateTotalPoolExpenses(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === 'pool_expense').reduce((s, t) => s + t.amount, 0);
}

export function calculateTotalSettlements(transactions: Transaction[]): number {
  return transactions.filter((t) => t.type === 'settlement').reduce((s, t) => s + t.amount, 0);
}

/**
 * Splits an amount equally among participants without losing/gaining a paisa.
 * Any remainder from integer division is distributed one paisa at a time
 * to the first participants.
 */
export function calculateExpenseShares(amountPaise: number, participantIds: string[]): Split[] {
  const n = participantIds.length;
  if (n === 0) return [];
  const base = Math.floor(amountPaise / n);
  const remainder = amountPaise - base * n;
  return participantIds.map((memberId, idx) => ({
    memberId,
    amount: base + (idx < remainder ? 1 : 0),
  }));
}

export function calculateCustomShares(amounts: Record<string, number>): Split[] {
  return Object.entries(amounts).map(([memberId, amount]) => ({ memberId, amount }));
}

export function calculatePercentageShares(
  amountPaise: number,
  percentages: Record<string, number>,
): Split[] {
  const entries = Object.entries(percentages);
  const n = entries.length;
  if (n === 0) return [];
  const raw = entries.map(([memberId, pct]) => ({
    memberId,
    exact: (amountPaise * pct) / 100,
  }));
  const floored = raw.map((r) => ({ memberId: r.memberId, amount: Math.floor(r.exact) }));
  let remainder = amountPaise - floored.reduce((s, f) => s + f.amount, 0);
  // Distribute leftover paise to entries with the largest fractional remainder first.
  const order = raw
    .map((r, idx) => ({ idx, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { idx } of order) {
    if (remainder <= 0) break;
    floored[idx].amount += 1;
    remainder -= 1;
  }
  return floored;
}

export interface SplitValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSplit(
  amountPaise: number,
  method: SplitMethod,
  splits: Split[],
  rawPercentages?: Record<string, number>,
): SplitValidationResult {
  if (splits.length === 0) {
    return { valid: false, error: 'Select at least one participant' };
  }
  if (splits.some((s) => s.amount < 0)) {
    return { valid: false, error: 'Shares cannot be negative' };
  }
  const total = splits.reduce((s, x) => s + x.amount, 0);
  if (total !== amountPaise) {
    return { valid: false, error: 'Split amounts must add up to the total expense' };
  }
  if (method === 'percentage' && rawPercentages) {
    const pctTotal = Object.values(rawPercentages).reduce((s, p) => s + p, 0);
    if (Math.round(pctTotal * 100) !== 10000) {
      return { valid: false, error: 'Percentages must total 100%' };
    }
  }
  return { valid: true };
}

/**
 * Individual settlement balance per member (paise). Positive = should receive money,
 * negative = should pay money. Derived purely from the transaction ledger.
 */
export function calculateMemberBalances(members: Member[], transactions: Transaction[]): Record<string, number> {
  const bal: Record<string, number> = {};
  members.forEach((m) => {
    bal[m.id] = 0;
  });

  transactions.forEach((t) => {
    if (t.type === 'contribution' && t.paidBy) {
      bal[t.paidBy] = (bal[t.paidBy] ?? 0) + t.amount;
    } else if (t.type === 'pool_expense') {
      (t.splits ?? []).forEach((s) => {
        bal[s.memberId] = (bal[s.memberId] ?? 0) - s.amount;
      });
    } else if (t.type === 'member_expense') {
      if (t.paidBy) bal[t.paidBy] = (bal[t.paidBy] ?? 0) + t.amount;
      (t.splits ?? []).forEach((s) => {
        bal[s.memberId] = (bal[s.memberId] ?? 0) - s.amount;
      });
    } else if (t.type === 'settlement' && t.paidBy && t.toMember) {
      bal[t.paidBy] = (bal[t.paidBy] ?? 0) + t.amount;
      bal[t.toMember] = (bal[t.toMember] ?? 0) - t.amount;
    }
  });

  return bal;
}

export function calculateUserBalance(members: Member[], transactions: Transaction[], memberId: string): number {
  return calculateMemberBalances(members, transactions)[memberId] ?? 0;
}

export interface BalanceExplanation {
  contributed: number;
  expenseShare: number;
  paidForGroup: number;
  settlementsSent: number;
  settlementsReceived: number;
  net: number;
}

export function explainBalance(transactions: Transaction[], memberId: string): BalanceExplanation {
  let contributed = 0;
  let expenseShare = 0;
  let paidForGroup = 0;
  let settlementsSent = 0;
  let settlementsReceived = 0;

  transactions.forEach((t) => {
    if (t.type === 'contribution' && t.paidBy === memberId) contributed += t.amount;
    if (t.type === 'pool_expense' || t.type === 'member_expense') {
      const s = (t.splits ?? []).find((x) => x.memberId === memberId);
      if (s) expenseShare += s.amount;
    }
    if (t.type === 'member_expense' && t.paidBy === memberId) paidForGroup += t.amount;
    if (t.type === 'settlement' && t.paidBy === memberId) settlementsSent += t.amount;
    if (t.type === 'settlement' && t.toMember === memberId) settlementsReceived += t.amount;
  });

  const net = contributed - expenseShare + paidForGroup + settlementsSent - settlementsReceived;
  return { contributed, expenseShare, paidForGroup, settlementsSent, settlementsReceived, net };
}

/**
 * Greedy min-transaction matching between debtors and creditors.
 * Guarantees total paid by debtors == total received by creditors, no rounding drift.
 */
export function calculateSettlementSuggestions(balances: Record<string, number>): SettlementTransfer[] {
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];

  Object.entries(balances).forEach(([id, amt]) => {
    if (amt > 0) creditors.push({ id, amt });
    else if (amt < 0) debtors.push({ id, amt: -amt });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers: SettlementTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amt = Math.min(c.amt, d.amt);
    if (amt > 0) {
      transfers.push({ from: d.id, to: c.id, amount: amt });
    }
    c.amt -= amt;
    d.amt -= amt;
    if (c.amt <= 0) ci += 1;
    if (d.amt <= 0) di += 1;
  }
  return transfers;
}

// ---------------------------------------------------------------------------
// Two-stage Settle Up: "Pool Funding" then "Member Settlement".
//
// The member balances already sum exactly to the pool balance (a contribution
// credits both the payer and the pool by the same amount; a pool expense
// debits both by the same amount; a member-paid expense and a settlement are
// zero-sum across members and never touch the pool). So a negative pool
// balance is never a *separate* debt on top of the negative member balances —
// it is the same shortfall, already distributed across the members who are
// currently negative. These functions decompose that shortfall into (a) the
// slice each negative-balance member should contribute back into the shared
// Pool and (b) whatever slice is left over as an ordinary member-to-member
// transfer, without altering `calculateMemberBalances` or
// `calculateSettlementSuggestions` at all.
// ---------------------------------------------------------------------------

export interface PoolFundingContribution {
  memberId: string;
  /** Paise still required from this member to fully fund the pool. */
  amount: number;
}

export interface PoolFundingPlan {
  /** Current pool balance (paise); may be positive, zero, or negative. */
  poolBalance: number;
  /** Paise still needed to bring the pool to zero. 0 when the pool is funded. */
  amountNeeded: number;
  /** Paise of the current underfunding episode's peak deficit (see calculatePoolFundingTarget). */
  target: number;
  /** Paise already funded back toward the target (target - amountNeeded). */
  funded: number;
  /** Per-member amounts still owed into the pool, in pot member order. Only members with amount > 0. */
  contributions: PoolFundingContribution[];
  /**
   * Balances after each debtor's pool-funding slice is notionally applied.
   * Creditors are unchanged. Feed this into `calculateSettlementSuggestions`
   * to get Stage 2's member-to-member transfers — this is the only place
   * that algorithm is reused, unmodified, for the two-stage flow.
   */
  residualBalances: Record<string, number>;
}

/**
 * Chronological low-water mark of the running pool balance for the current,
 * still-unresolved underfunding episode (paise, >= 0). Resets to 0 whenever
 * the running balance recovers to non-negative, so a past, already-resolved
 * shortfall never inflates today's funding target. Purely derived from the
 * ledger — nothing is stored.
 */
export function calculatePoolFundingTarget(transactions: Transaction[]): number {
  const chronological = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return 0;
  });
  let pool = 0;
  let episodeLow = 0;
  for (const t of chronological) {
    if (t.type === 'contribution') pool += t.amount;
    else if (t.type === 'pool_expense') pool -= t.amount;
    episodeLow = pool >= 0 ? 0 : Math.min(episodeLow, pool);
  }
  return -episodeLow;
}

/**
 * Builds the Stage 1 (Pool Funding) plan. Debtors are walked in pot member
 * order, each contributing up to their own debt toward the outstanding pool
 * need until it is exhausted; any leftover debt becomes residual (Stage 2)
 * debt. Because amountNeeded = totalDebt - totalCredit, and totalDebt is
 * always >= amountNeeded, every paisa of pool need is always allocated and
 * the residual debtors' total always equals total credit exactly — so
 * Stage 2's `calculateSettlementSuggestions(residualBalances)` always nets
 * to zero drift, same guarantee it already has today.
 */
export function calculatePoolFundingPlan(members: Member[], transactions: Transaction[]): PoolFundingPlan {
  const poolBalance = calculatePoolBalance(transactions);
  const balances = calculateMemberBalances(members, transactions);
  const amountNeeded = Math.max(-poolBalance, 0);
  const target = Math.max(calculatePoolFundingTarget(transactions), amountNeeded);
  const funded = target - amountNeeded;

  const residualBalances: Record<string, number> = {};
  members.forEach((m) => {
    residualBalances[m.id] = balances[m.id] ?? 0;
  });

  const contributions: PoolFundingContribution[] = [];
  let remaining = amountNeeded;
  for (const m of members) {
    if (remaining <= 0) break;
    const bal = balances[m.id] ?? 0;
    if (bal >= 0) continue;
    const debt = -bal;
    const contribution = Math.min(debt, remaining);
    if (contribution > 0) {
      contributions.push({ memberId: m.id, amount: contribution });
      residualBalances[m.id] = bal + contribution;
      remaining -= contribution;
    }
  }

  return { poolBalance, amountNeeded, target, funded, contributions, residualBalances };
}

/** Stage 2: member-to-member transfers left once each debtor's pool-funding slice is accounted for. */
export function calculateMemberSettlementTransfers(members: Member[], transactions: Transaction[]): SettlementTransfer[] {
  const plan = calculatePoolFundingPlan(members, transactions);
  return calculateSettlementSuggestions(plan.residualBalances);
}

export type MyPositionKind = 'settled' | 'receive' | 'pool_only' | 'pool_and_member' | 'member_only';

export interface MyPositionMemberTransfer {
  toMemberId: string;
  amount: number;
}

export interface MyPosition {
  kind: MyPositionKind;
  /** Total paise this member needs to act on (add to pool + pay members), or receive when kind === 'receive'. */
  amount: number;
  /** Paise of `amount` that should go into the shared Pool (kind pool_only / pool_and_member). */
  poolAmount: number;
  /** Member-to-member transfers this member still needs to make (kind member_only / pool_and_member). */
  memberTransfers: MyPositionMemberTransfer[];
}

/**
 * The single source of truth for "what does the logged-in member need to do"
 * — built entirely from the existing balance + the Stage 1/2 plan above, so
 * it can never double-count the pool deficit against a member's own balance.
 */
export function calculateMyPosition(
  members: Member[],
  transactions: Transaction[],
  memberId: string,
): MyPosition {
  const balances = calculateMemberBalances(members, transactions);
  const myBalance = balances[memberId] ?? 0;

  if (myBalance === 0) {
    return { kind: 'settled', amount: 0, poolAmount: 0, memberTransfers: [] };
  }
  if (myBalance > 0) {
    return { kind: 'receive', amount: myBalance, poolAmount: 0, memberTransfers: [] };
  }

  const plan = calculatePoolFundingPlan(members, transactions);
  const poolAmount = plan.contributions.find((c) => c.memberId === memberId)?.amount ?? 0;
  const transfers = calculateSettlementSuggestions(plan.residualBalances)
    .filter((t) => t.from === memberId)
    .map((t) => ({ toMemberId: t.to, amount: t.amount }));
  const memberAmount = transfers.reduce((s, t) => s + t.amount, 0);
  const amount = poolAmount + memberAmount;

  const kind: MyPositionKind = poolAmount > 0 && memberAmount > 0 ? 'pool_and_member' : poolAmount > 0 ? 'pool_only' : 'member_only';
  return { kind, amount, poolAmount, memberTransfers: transfers };
}

export interface SettlementProgress {
  completedCount: number;
  completedAmount: number;
  outstandingCount: number;
  outstandingAmount: number;
  totalCount: number;
  totalAmount: number;
}

/**
 * Derives settlement progress purely from the ledger: completed settlement
 * transactions vs. the currently outstanding suggested transfers. Nothing
 * here is cached — recalculated fresh every time transactions change.
 */
export function calculateSettlementProgress(
  members: Member[],
  transactions: Transaction[],
): SettlementProgress {
  const completed = transactions.filter((t) => t.type === 'settlement');
  const completedCount = completed.length;
  const completedAmount = completed.reduce((s, t) => s + t.amount, 0);

  const balances = calculateMemberBalances(members, transactions);
  const outstanding = calculateSettlementSuggestions(balances);
  const outstandingCount = outstanding.length;
  const outstandingAmount = outstanding.reduce((s, t) => s + t.amount, 0);

  return {
    completedCount,
    completedAmount,
    outstandingCount,
    outstandingAmount,
    totalCount: completedCount + outstandingCount,
    totalAmount: completedAmount + outstandingAmount,
  };
}

/** Cannot pay zero, negative, or more than what is actually outstanding. */
export function validateSettlementAmount(outstandingPaise: number, amountPaise: number): SplitValidationResult {
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { valid: false, error: 'Enter an amount greater than zero' };
  }
  if (amountPaise > outstandingPaise) {
    return { valid: false, error: `Payment cannot exceed the outstanding amount of ${formatMoneyPaise(outstandingPaise)}.` };
  }
  return { valid: true };
}

/** A member can never settle with themselves, and both parties must belong to the pot. */
export function validateSettlementParties(
  members: Member[],
  fromMemberId: string,
  toMemberId: string,
): SplitValidationResult {
  if (fromMemberId === toMemberId) {
    return { valid: false, error: 'A member cannot settle with themselves' };
  }
  const ids = new Set(members.map((m) => m.id));
  if (!ids.has(fromMemberId) || !ids.has(toMemberId)) {
    return { valid: false, error: 'Both members must belong to this pot' };
  }
  return { valid: true };
}

// Local, dependency-free money formatter so this file has no UI imports.
// Kept in sync with the decimal-precision rules in `src/utils/money.ts`.
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

/**
 * Sorts transactions most-recent-first: by transaction date, then by
 * creation time as a tiebreaker so same-day entries show newest-added
 * first regardless of type (contribution, expense, or settlement).
 */
export function sortTransactionsRecentFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

export function calculateMemberContributed(transactions: Transaction[], memberId: string): number {
  return transactions
    .filter((t) => t.type === 'contribution' && t.paidBy === memberId)
    .reduce((s, t) => s + t.amount, 0);
}

export function calculateMemberPaidForGroup(transactions: Transaction[], memberId: string): number {
  return transactions
    .filter((t) => t.type === 'member_expense' && t.paidBy === memberId)
    .reduce((s, t) => s + t.amount, 0);
}

export interface ContributionSummary {
  memberId: string;
  /** Sum of this member's contribution transaction amounts, paise. */
  total: number;
  /** Number of individual contribution transactions. */
  count: number;
}

/**
 * Per-member contribution totals, for the Activity screen's member-wise
 * Contributions view. Seeded from `members` (like calculateMemberBalances)
 * so every current pot member appears even with zero contributions; a
 * contribution from a member no longer in `members` (e.g. historical data
 * for a removed member) still gets its own entry rather than being dropped.
 * Never aggregates by name — always by the stable member id.
 */
export function calculateContributionSummaries(members: Member[], transactions: Transaction[]): ContributionSummary[] {
  const byMember = new Map<string, ContributionSummary>();
  members.forEach((m) => byMember.set(m.id, { memberId: m.id, total: 0, count: 0 }));

  transactions.forEach((t) => {
    if (t.type !== 'contribution' || !t.paidBy) return;
    const existing = byMember.get(t.paidBy) ?? { memberId: t.paidBy, total: 0, count: 0 };
    existing.total += t.amount;
    existing.count += 1;
    byMember.set(t.paidBy, existing);
  });

  return Array.from(byMember.values());
}

/**
 * Orders contribution summaries: highest total first (which naturally puts
 * every contributor ahead of every zero-contribution member), with ties
 * (including all-zero members) broken by `memberOrder` — the pot's own
 * member ordering — for a stable, non-arbitrary result.
 */
export function sortContributionSummaries(
  summaries: ContributionSummary[],
  memberOrder: string[],
): ContributionSummary[] {
  const orderIndex = new Map(memberOrder.map((id, i) => [id, i]));
  return [...summaries].sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total;
    return (orderIndex.get(a.memberId) ?? 0) - (orderIndex.get(b.memberId) ?? 0);
  });
}

export type ContributionExpectationStatus = 'none' | 'below' | 'on_track' | 'above';

export interface ContributionExpectation {
  status: ContributionExpectationStatus;
  /** Paise vs. expected: negative when below, positive when above, 0 for on_track/none. */
  difference: number;
}

/**
 * Purely informational comparison of one member's contribution total against
 * the Pot's optional `expectedContributionPerMember` — never derived from the
 * current contribution total itself (that would be circular and hide
 * under-contribution), only from that stored, admin-set value. Returns
 * `'none'` whenever no expectation is configured, so callers can hide the
 * warning UI entirely rather than inventing one.
 *
 * This never touches balances, the pool, or settlement — see
 * calculateMemberBalances / calculateSettlementSuggestions for those.
 */
export function evaluateContributionExpectation(
  total: number,
  expectedPerMember: number | null | undefined,
): ContributionExpectation {
  if (expectedPerMember == null || expectedPerMember <= 0) {
    return { status: 'none', difference: 0 };
  }
  const difference = total - expectedPerMember;
  if (difference === 0) return { status: 'on_track', difference: 0 };
  return { status: difference > 0 ? 'above' : 'below', difference };
}
