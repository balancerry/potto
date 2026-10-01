import Image from 'next/image';
import Link from 'next/link';
import { CalendarHeart, CircleHelp, Plane, Plus, Receipt, Target, Users, Wallet } from 'lucide-react';
import emptyPottoArt from '@/assets/empty-potto.png';
import { ButtonLink } from '@/components/ui/button';

const STEPS = [
  {
    n: '01',
    title: 'Collect',
    body: "Add people to your Pot and collect contributions into the shared pool. Everyone can see what's been added.",
    icon: Wallet,
  },
  {
    n: '02',
    title: 'Spend',
    body: 'Record expenses paid from the pool or by a member. Potto keeps group spending and remaining money together.',
    icon: Receipt,
  },
  {
    n: '03',
    title: 'Settle',
    body: 'When the Pot is ready to settle, Potto works out who needs to add money and who should receive it.',
    icon: Users,
  },
] as const;

const USES = [
  {
    title: 'Trips',
    body: 'Collect and manage shared money for travel, food, stays, transport, and more.',
    icon: Plane,
  },
  {
    title: 'Events',
    body: 'Manage shared contributions and spending for weddings, parties, celebrations, and group events.',
    icon: CalendarHeart,
  },
  {
    title: 'Group goals',
    body: 'Keep contributions and shared spending organized for any temporary group fund.',
    icon: Target,
  },
] as const;

export function EmptyPotsState() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-8 text-center shadow-sm sm:px-14 sm:py-12">
        <Image
          src={emptyPottoArt}
          alt=""
          priority
          className="mx-auto h-auto w-full max-w-xs object-contain sm:max-w-sm"
          sizes="(max-width: 640px) 80vw, 384px"
        />
        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          Create your first Pot
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          Collect, spend, and settle group money in one shared place.
        </p>
        <div className="mt-6">
          <ButtonLink href="/pots/new" size="lg" className="h-[52px] w-full px-7 active:bg-accent/80 sm:w-auto">
            <Plus className="size-4" aria-hidden />
            Create your first pot
          </ButtonLink>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Have an invite?{' '}
          <Link
            href="/join"
            className="font-medium text-ink underline-offset-2 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            Join a pot →
          </Link>
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-ink">How Potto works</h2>
        <ul className="mt-5 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.title}
              className="flex h-full min-w-0 flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                <step.icon className="size-5" aria-hidden />
              </span>
              <p className="mt-4 font-sans text-lg font-semibold text-accent">{step.n}</p>
              <p className="mt-1 font-medium text-ink">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold text-ink">What can I use Potto for?</h2>
        <ul className="mt-5 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          {USES.map((use) => (
            <li key={use.title} className="flex h-full min-w-0 flex-col rounded-[var(--radius-lg)] border border-line px-5 py-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft/70 text-accent">
                <use.icon className="size-5" aria-hidden />
              </span>
              <p className="mt-3 font-medium text-ink">{use.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{use.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 className="font-medium text-ink">Need help?</h2>
            <p className="mt-1 text-sm text-ink-soft">Learn how Potto works and find answers to common questions.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/help/how-potto-works" variant="outline" size="sm">
            How Potto works
          </ButtonLink>
          <Link
            href="/help/faq"
            className="inline-flex h-9 items-center px-3 text-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            Browse FAQs →
          </Link>
        </div>
      </section>
    </div>
  );
}
