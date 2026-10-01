import {
  CalendarClock,
  ListChecks,
  Plus,
  Receipt,
  Scale,
  Users,
  Wallet,
} from 'lucide-react';
import { HelpFrame } from '@/components/help/help-frame';

export const metadata = { title: 'How Potto works' };

const STEPS = [
  {
    n: '01',
    title: 'Create a Pot',
    body: 'Create a shared Pot for your trip, event, or group goal.',
    icon: Plus,
  },
  {
    n: '02',
    title: 'Add people',
    body: 'Invite your group and keep everyone connected to the same Pot.',
    icon: Users,
  },
  {
    n: '03',
    title: 'Collect',
    body: 'Record contributions from members into the shared pool.',
    icon: Wallet,
  },
  {
    n: '04',
    title: 'Spend',
    body: 'Record expenses paid from the pool or personally by a member.',
    icon: Receipt,
  },
  {
    n: '05',
    title: 'Plan',
    body: 'Track planned payments without counting them as spent money yet.',
    icon: CalendarClock,
  },
  {
    n: '06',
    title: 'Settle',
    body: "Potto calculates what members need to add or receive after the group's spending is recorded.",
    icon: Scale,
  },
  {
    n: '07',
    title: 'Review',
    body: "Use the summary and transaction history to see where the group's money went.",
    icon: ListChecks,
  },
] as const;

export default function HowPottoWorksPage() {
  return (
    <HelpFrame
      title="How Potto works"
      lede="Potto gives your group one shared place to collect money, track spending, plan planned payments, and settle up."
    >
      <ol className="grid gap-4">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <step.icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-sans text-sm font-semibold text-accent">{step.n}</p>
              <h2 className="mt-0.5 font-medium text-ink">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </HelpFrame>
  );
}
