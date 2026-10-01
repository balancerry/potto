import Link from 'next/link';
import { BookOpen, CircleHelp, MessagesSquare } from 'lucide-react';
import { HelpFrame } from '@/components/help/help-frame';

export const metadata = { title: 'Help' };

const CARDS = [
  {
    href: '/help/how-potto-works',
    title: 'How Potto works',
    body: 'Understand the Pot lifecycle.',
    icon: BookOpen,
  },
  {
    href: '/help/faq',
    title: 'FAQs',
    body: 'Find answers to common questions.',
    icon: CircleHelp,
  },
] as const;

export default function HelpPage() {
  return (
    <HelpFrame title="How can we help?" back={false}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="flex h-full gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5 hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <card.icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-medium text-ink">{card.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{card.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="flex gap-4 rounded-[var(--radius-lg)] border border-line px-5 py-4">
        <MessagesSquare className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="font-medium text-ink">Contact support</h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
            For a specific Pot, ask a pot admin. For how the product works, start with How Potto works or the FAQs.
          </p>
        </div>
      </section>
    </HelpFrame>
  );
}
