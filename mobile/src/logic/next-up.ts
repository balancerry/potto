import {
  calculateContributionSummaries,
  calculateMemberSettlementTransfers,
  calculatePoolBalance,
  calculatePoolFundingPlan,
  calculateTotalContributions,
} from '@/logic/accounting';
import {
  calculateCommitmentRemaining,
  calculatePotentialShortfall,
  calculateTotalUpcomingRemaining,
  deriveCommitmentStatus,
  deriveDueDateState,
} from '@/logic/commitments';
import type { Commitment, CommitmentPayment, Member, Transaction } from '@/types/models';

export type NextUpType =
  | 'balance_pool'
  | 'record_payment'
  | 'collect_contributions'
  | 'settle_members'
  | 'complete';

export type NextActionTarget =
  | 'add_contribution'
  | 'view_contributions'
  | 'record_payment'
  | 'settle'
  | 'summary'
  | 'invite';

export interface PotNextAction {
  type: NextUpType;
  title: string;
  description: string;
  supporting?: string;
  primaryLabel: string;
  target: NextActionTarget;
  secondaryLabel?: string;
  secondaryTarget?: NextActionTarget;
  commitmentId?: string;
  amountPaise?: number;
  amountLabel?: string;
}

function duePhrase(dueDate: string | undefined, state: string, todayISO: string): string {
  if (state === 'overdue') return 'is overdue';
  if (state === 'due_today') return 'is due today';
  if (!dueDate) return 'has no due date';
  const days = Math.round((Date.parse(dueDate) - Date.parse(todayISO)) / 86_400_000);
  if (days === 1) return 'is due tomorrow';
  if (days > 1) return `is due in ${days} days`;
  return 'is due soon';
}

function people(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * One next step for a pot. Same priority on web and mobile:
 * pool shortfall, a due payment, missing contributions, any open payment,
 * settlement, then complete. A new pot with no expenses does not lead with settlement.
 */
export function getPotNextAction(input: {
  members: Member[];
  transactions: Transaction[];
  commitments: Commitment[];
  commitmentPayments: CommitmentPayment[];
  expectedContributionPerMember?: number | null;
  todayISO?: string;
}): PotNextAction {
  const active = input.members.filter((m) => m.status === 'active');
  const summaries = calculateContributionSummaries(active, input.transactions);
  const contributedCount = summaries.filter((s) => s.total > 0).length;
  const missing = Math.max(active.length - contributedCount, 0);
  const contributed = calculateTotalContributions(input.transactions);
  const pool = calculatePoolBalance(input.transactions);
  const upcoming = calculateTotalUpcomingRemaining(input.commitments, input.commitmentPayments, input.transactions);
  const shortfall = calculatePotentialShortfall(pool, upcoming);
  const expected = input.expectedContributionPerMember ?? null;
  const stillToCollect = expected != null && expected > 0 ? Math.max(expected * active.length - contributed, 0) : 0;
  const today = input.todayISO ?? new Date().toISOString().slice(0, 10);

  const open = input.commitments
    .map((c) => {
      const status = deriveCommitmentStatus(
        c,
        input.commitmentPayments
          .filter((p) => p.commitmentId === c.id)
          .reduce((sum, p) => {
            const tx = input.transactions.find((t) => t.id === p.transactionId);
            return sum + (tx ? tx.amount : 0);
          }, 0),
      );
      return {
        c,
        status,
        remaining: calculateCommitmentRemaining(c, input.commitmentPayments, input.transactions),
        due: deriveDueDateState(c, status, today),
      };
    })
    .filter((row) => row.status === 'planned' || row.status === 'partially_paid');

  const urgent = open
    .filter((row) => row.due === 'overdue' || row.due === 'due_today' || row.due === 'due_soon')
    .sort((a, b) => (a.c.dueDate ?? '9999').localeCompare(b.c.dueDate ?? '9999'))[0];

    const funding = calculatePoolFundingPlan(active, input.transactions);
  const memberPayments = calculateMemberSettlementTransfers(active, input.transactions);

  if (shortfall > 0 && upcoming > 0) {
    return {
      type: 'balance_pool',
      title: 'Top up the Pot',
      description: 'More money is needed to cover planned payments.',
      amountPaise: shortfall,
      amountLabel: 'is still needed',
      primaryLabel: 'Add contribution',
      target: 'add_contribution',
    };
  }

  if (urgent && urgent.remaining > 0) {
    return {
      type: 'record_payment',
      title: 'Payment coming up',
      description: `${urgent.c.title} ${duePhrase(urgent.c.dueDate, urgent.due, today)}.`,
      amountPaise: urgent.remaining,
      amountLabel: 'remaining',
      primaryLabel: 'View payment',
      target: 'record_payment',
      commitmentId: urgent.c.id,
    };
  }

  if (funding.amountNeeded > 0) {
    return {
      type: 'balance_pool',
      title: 'Balance the pool',
      description: 'The group pool is short of the money already spent from it.',
      amountPaise: funding.amountNeeded,
      amountLabel: 'is still needed',
      primaryLabel: 'View settlement',
      target: 'settle',
    };
  }

  if (input.transactions.length === 0 && input.commitments.length === 0) {
    return {
      type: 'collect_contributions',
      title: 'Get your group started',
      description: 'Add people and collect the first contributions to get your Pot moving.',
      primaryLabel: 'Add contribution',
      target: 'add_contribution',
    };
  }

  if (missing > 0 || stillToCollect > 0) {
    return {
      type: 'collect_contributions',
      title: 'Collect contributions',
      description:
        missing > 0
          ? `${missing} of ${active.length} ${active.length === 1 ? 'member hasn\'t' : 'members haven\'t'} contributed yet.`
          : 'Expected contributions are still being collected.',
      amountPaise: stillToCollect > 0 ? stillToCollect : undefined,
      amountLabel: stillToCollect > 0 ? 'still to collect' : undefined,
      primaryLabel: 'Add contribution',
      target: 'add_contribution',
    };
  }

  if (memberPayments.length > 0) {
    const settling = new Set(memberPayments.map((payment) => payment.from)).size;
    return {
      type: 'settle_members',
      title: 'Settle up',
      description:
        settling === 1 ? '1 member needs to settle their balance.' : `${settling} members need to settle their balances.`,
      primaryLabel: 'Settle up',
      target: 'settle',
    };
  }

  return {
    type: 'complete',
    title: "You're all set",
    description: 'Nothing needs your attention right now.',
    primaryLabel: 'View summary',
    target: 'summary',
  };
}
