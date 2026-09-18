import {
  calculateContributionSummaries,
  calculateMemberBalances,
  calculateMemberSettlementTransfers,
  calculatePoolBalance,
  calculatePoolFundingPlan,
  calculateTotalContributions,
  calculateTotalPoolExpenses,
  calculateTotalSpent,
  evaluateContributionExpectation,
  sortContributionSummaries,
  type ContributionExpectation,
} from '@/lib/core/logic/accounting';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  calculateTotalUpcomingRemaining,
  deriveCommitmentStatus,
} from '@/lib/core/logic/commitments';
import type { Commitment, CommitmentPayment, CommitmentStatus, MemberStatus, Pot, Transaction } from '@/types/models';

/**
 * The single Pot Summary view-model: every number here is derived only from
 * the existing accounting engine (src/logic/accounting.ts) and Commitments
 * engine (src/logic/commitments.ts) — nothing here recomputes balances,
 * settlement, or totals independently. Both the in-app Pot Summary screen
 * and the PDF generator consume this same object, so they can never disagree
 * (see src/app/pot/[id]/summary.tsx and src/logic/pot-summary-html.ts).
 */

export interface PotSummaryMemberContribution {
  memberId: string;
  name: string;
  total: number; // paise
  count: number;
  expectation: ContributionExpectation;
}

export interface PotSummaryExpenseCategory {
  category: string;
  amount: number; // paise
  /** 0-100, one decimal place. */
  percentage: number;
}

export interface PotSummaryExpenseItem {
  id: string;
  date: string;
  description: string;
  amount: number; // paise
  category?: string;
}

export interface PotSummaryUpcomingPayment {
  id: string;
  title: string;
  vendorName?: string;
  totalAmount: number; // paise
  paid: number; // paise
  remaining: number; // paise
  dueDate?: string;
  status: CommitmentStatus;
}

export interface PotSummaryMemberBalance {
  memberId: string;
  name: string;
  balance: number; // paise, positive = should receive, negative = should pay
  status: MemberStatus;
}

export interface PotSummaryPoolFundingEntry {
  memberId: string;
  name: string;
  amount: number; // paise still owed into the pool
}

export interface PotSummaryMemberTransfer {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number; // paise
}

export interface PotSummaryViewModel {
  potId: string;
  potName: string;
  /** Active members only — the count a report reader means by "N Members". */
  memberCount: number;
  generatedAt: string; // ISO datetime

  pool: {
    contributed: number; // paise
    totalSpent: number; // paise — pool + member-paid expenses (same as the Dashboard's "Spent" stat)
    balance: number; // paise — Contributions - Pool Expenses
  };

  contributions: {
    total: number; // paise, equals pool.contributed
    members: PotSummaryMemberContribution[];
    expectedPerMember: number | null;
  };

  expenses: {
    /** Pool expenses only (paise) — matches the Dashboard/Commitments' "not included in Total Spent" pool-expense concept. */
    total: number;
    categories: PotSummaryExpenseCategory[];
    items: PotSummaryExpenseItem[];
  };

  upcoming: {
    totalRemaining: number; // paise
    items: PotSummaryUpcomingPayment[];
  };

  /** Every member the report should show — see buildPotSummaryViewModel for the inclusion rule. */
  balances: PotSummaryMemberBalance[];

  settlement: {
    poolFunding: PotSummaryPoolFundingEntry[];
    poolFundingTotal: number; // paise still needed to bring the pool to zero
    poolFundingFunded: number; // paise already funded back toward the target
    poolFundingTarget: number; // paise, peak deficit of the current underfunding episode
    memberTransfers: PotSummaryMemberTransfer[];
    memberSettlementOutstanding: number; // paise, sum of memberTransfers
    memberSettlementCompleted: number; // paise, sum of all recorded settlement transactions
    allSettled: boolean;
  };

  status: {
    poolBalanced: boolean;
    poolShortfall: number; // paise, 0 when balanced
    upcomingRemaining: number; // paise
    settlementActionsRemaining: boolean;
  };
}

/**
 * Builds the Pot Summary view-model. Every figure is either a direct call
 * into the accounting/commitments engines or a straightforward
 * grouping/sort of their output — no independent money math lives here.
 */
export function buildPotSummaryViewModel(
  pot: Pot,
  transactions: Transaction[],
  commitments: Commitment[],
  commitmentPayments: CommitmentPayment[],
  generatedAt: string = new Date().toISOString(),
): PotSummaryViewModel {
  const members = pot.members;
  const nameOf = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? '—';

  // ---- Pool + contributions ------------------------------------------------
  const contributed = calculateTotalContributions(transactions);
  const totalSpent = calculateTotalSpent(transactions);
  const poolBalance = calculatePoolBalance(transactions);

  const rawSummaries = calculateContributionSummaries(members, transactions);
  // Same rule as ContributionsTab: a removed member with zero contributions
  // adds nothing useful; one who actually contributed keeps their row.
  const visibleSummaries = rawSummaries.filter((s) => {
    const member = members.find((m) => m.id === s.memberId);
    return s.count > 0 || member?.status === 'active';
  });
  const sortedSummaries = sortContributionSummaries(
    visibleSummaries,
    members.map((m) => m.id),
  );
  const expectedPerMember = pot.expectedContributionPerMember ?? null;
  const contributionMembers: PotSummaryMemberContribution[] = sortedSummaries.map((s) => ({
    memberId: s.memberId,
    name: nameOf(s.memberId),
    total: s.total,
    count: s.count,
    expectation: evaluateContributionExpectation(s.total, expectedPerMember),
  }));

  // ---- Expenses (pool expenses only — member-paid expenses never leave the
  // pool and are covered by member balances / settlement below) ------------
  const totalPoolExpenses = calculateTotalPoolExpenses(transactions);
  const poolExpenseTxs = transactions.filter((t) => t.type === 'pool_expense');

  const categoryTotals = new Map<string, number>();
  poolExpenseTxs.forEach((t) => {
    const category = t.category?.trim() || 'Other';
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + t.amount);
  });
  const categories: PotSummaryExpenseCategory[] = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalPoolExpenses > 0 ? Math.round((amount / totalPoolExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const items: PotSummaryExpenseItem[] = [...poolExpenseTxs]
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .map((t) => ({ id: t.id, date: t.date, description: t.description, amount: t.amount, category: t.category }));

  // ---- Upcoming payments (never affects the totals above) ------------------
  const upcomingTotal = calculateTotalUpcomingRemaining(commitments, commitmentPayments, transactions);
  const upcomingItems: PotSummaryUpcomingPayment[] = commitments
    .filter((c) => c.status !== 'cancelled')
    .map((c) => {
      const paid = calculateCommitmentPaid(c.id, commitmentPayments, transactions);
      const remaining = calculateCommitmentRemaining(c, commitmentPayments, transactions);
      return {
        id: c.id,
        title: c.title,
        vendorName: c.vendorName,
        totalAmount: c.totalAmount,
        paid,
        remaining,
        dueDate: c.dueDate,
        status: deriveCommitmentStatus(c, paid),
      };
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  // ---- Member balances -------------------------------------------------
  // Every active member always appears; a removed member only if their
  // financial identity (preserved per spec) still carries a non-zero balance.
  const balancesMap = calculateMemberBalances(members, transactions);
  const balances: PotSummaryMemberBalance[] = members
    .filter((m) => m.status === 'active' || (balancesMap[m.id] ?? 0) !== 0)
    .map((m) => ({ memberId: m.id, name: m.name, balance: balancesMap[m.id] ?? 0, status: m.status }));

  // ---- Settlement: Pool Funding (Stage 1) then Member Settlement (Stage 2) -
  const plan = calculatePoolFundingPlan(members, transactions);
  const poolFunding: PotSummaryPoolFundingEntry[] = plan.contributions.map((c) => ({
    memberId: c.memberId,
    name: nameOf(c.memberId),
    amount: c.amount,
  }));
  const memberTransfers: PotSummaryMemberTransfer[] = calculateMemberSettlementTransfers(members, transactions).map(
    (t) => ({ fromId: t.from, fromName: nameOf(t.from), toId: t.to, toName: nameOf(t.to), amount: t.amount }),
  );
  const memberSettlementOutstanding = memberTransfers.reduce((s, t) => s + t.amount, 0);
  const memberSettlementCompleted = transactions
    .filter((t) => t.type === 'settlement')
    .reduce((s, t) => s + t.amount, 0);
  const allSettled = plan.amountNeeded === 0 && memberTransfers.length === 0;

  return {
    potId: pot.id,
    potName: pot.name,
    memberCount: members.filter((m) => m.status === 'active').length,
    generatedAt,
    pool: { contributed, totalSpent, balance: poolBalance },
    contributions: { total: contributed, members: contributionMembers, expectedPerMember },
    expenses: { total: totalPoolExpenses, categories, items },
    upcoming: { totalRemaining: upcomingTotal, items: upcomingItems },
    balances,
    settlement: {
      poolFunding,
      poolFundingTotal: plan.amountNeeded,
      poolFundingFunded: plan.funded,
      poolFundingTarget: plan.target,
      memberTransfers,
      memberSettlementOutstanding,
      memberSettlementCompleted,
      allSettled,
    },
    status: {
      poolBalanced: plan.amountNeeded === 0,
      poolShortfall: plan.amountNeeded,
      upcomingRemaining: upcomingTotal,
      settlementActionsRemaining: !allSettled,
    },
  };
}
