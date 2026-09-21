import Image from 'next/image';
import Link from 'next/link';
import { FileText, Heart, Lightbulb, Plane, Plus, Users } from 'lucide-react';
import emptyPottoArt from '@/assets/empty-potto.png';
import newToPottoBg from '@/assets/new-to-potto-bg.png';
import { ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const REASONS = [
  {
    title: 'Split expenses',
    description: 'Track who paid what without the spreadsheet chaos.',
    icon: Users,
    tone: 'bg-accent-soft text-accent',
  },
  {
    title: 'Perfect for trips',
    description: 'One shared pot for the whole adventure.',
    icon: Plane,
    tone: 'bg-[#e4eef8] text-[#3a6ea5]',
  },
  {
    title: 'Stay transparent',
    description: 'Everyone sees the same numbers, always.',
    icon: FileText,
    tone: 'bg-neg-soft text-neg',
  },
  {
    title: 'Less awkward',
    description: 'Settlements without the money talk stress.',
    icon: Heart,
    tone: 'bg-gold-soft text-gold',
  },
] as const;

export function EmptyPotsState() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="relative overflow-hidden rounded-[var(--radius-lg)]">
        <div className="relative mx-auto w-full max-w-3xl px-2 pt-2 sm:pt-4">
          <Image
            src={emptyPottoArt}
            alt=""
            priority
            className="mx-auto h-auto w-full max-w-2xl object-contain"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        </div>

        <div className="relative z-10 mx-auto -mt-6 w-full max-w-lg px-3 sm:-mt-10 sm:px-0">
          <div className="rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-7 text-center shadow-md sm:px-8 sm:py-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.65rem]">
              You don&apos;t have any pots yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              Create a pot for your next trip, event, or shared goal. Invite your friends and start
              tracking expenses together.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <ButtonLink href="/pots/new">
                <Plus className="size-4" />
                Create pot
              </ButtonLink>
              <ButtonLink href="/join" variant="outline">
                <Users className="size-4" />
                Join a pot
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-center font-display text-xl font-semibold text-ink sm:text-2xl">
          Why create a pot?
        </h2>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map(({ title, description, icon: Icon, tone }) => (
            <li key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <span className={cn('flex size-11 items-center justify-center rounded-full', tone)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-snug text-ink-soft">{description}</p>
            </li>
          ))}
        </ul>
      </section>

      <NewUserGuidance />
    </div>
  );
}

export function NewUserGuidance() {
  return (
    <aside className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[#e8f0ea]">
      <Image
        src={newToPottoBg}
        alt=""
        aria-hidden
        className="block h-auto w-full scale-[1.01]"
        sizes="(max-width: 1152px) 100vw, 1152px"
      />
      <div className="absolute inset-0 z-10 flex items-center px-5 sm:px-6">
        <div className="flex max-w-[min(100%,28rem)] items-start gap-3 sm:max-w-xl sm:items-center">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-sm sm:mt-0">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-ink">
            <span className="font-semibold text-accent">New to Potto?</span>{' '}
            <span className="text-ink-soft">
              Create a pot, invite your friends, and start tracking shared expenses easily.
            </span>{' '}
            <Link
              href="/pots/new"
              className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            >
              Learn more →
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
