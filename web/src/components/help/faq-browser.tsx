'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Category =
  | 'Getting started'
  | 'Contributions'
  | 'Expenses'
  | 'Planned payments'
  | 'Settlements'
  | 'Pot management'
  | 'Account';

const CATEGORIES: Array<'All' | Category> = [
  'All',
  'Getting started',
  'Contributions',
  'Expenses',
  'Planned payments',
  'Settlements',
  'Pot management',
  'Account',
];

const FAQS: { category: Category; question: string; answer: string }[] = [
  {
    category: 'Getting started',
    question: 'What is a Pot?',
    answer:
      'A Pot is one shared place for a group’s money. You collect contributions, record spending, and settle what is left. Each Pot stays separate from your others.',
  },
  {
    category: 'Getting started',
    question: 'How do I create a Pot?',
    answer:
      'From Your pots, choose Create your first pot. After you have a Pot, Create pot stays in the page header. Give the Pot a name, then invite the group.',
  },
  {
    category: 'Getting started',
    question: 'How do I join a Pot?',
    answer:
      'Choose Join a pot and use the invite your group shared. A pot admin reviews the request before you become a member.',
  },
  {
    category: 'Getting started',
    question: 'Can I have multiple Pots?',
    answer: 'Yes. Each Pot has its own people, money, and history. One Pot never changes another.',
  },
  {
    category: 'Contributions',
    question: 'How do contributions work?',
    answer:
      'A contribution is money a member adds to the Pot. It increases the shared pool and stays attached to that member, so you can see who has paid.',
  },
  {
    category: 'Contributions',
    question: 'Can multiple people contribute at once?',
    answer:
      'Yes. When you add money, choose Multiple members. You can use one amount for everyone or type a different amount for each person. Potto still saves a separate contribution for every member.',
  },
  {
    category: 'Expenses',
    question: "What's the difference between a pool expense and a member-paid expense?",
    answer:
      'A pool expense is paid from the group’s collected money, so the pool goes down. A member-paid expense is paid personally by someone in the group. It does not reduce the pool, and that person is credited for what they covered.',
  },
  {
    category: 'Planned payments',
    question: 'Do planned payments count as spent money?',
    answer:
      'No. An planned payment is a plan, such as a hotel or vendor you still need to pay. It stays out of the pool until someone records the actual expense.',
  },
  {
    category: 'Settlements',
    question: 'How does Potto calculate settlements?',
    answer:
      'Potto compares what each member contributed and paid with their share of group expenses. It first shows money still needed in the pool, then any remaining payments between members.',
  },
  {
    category: 'Settlements',
    question: 'Can I settle partially?',
    answer:
      'Yes. Mark a suggested payment as paid, or record a custom settlement for part of what is owed. Anything still open stays on the Settle page.',
  },
  {
    category: 'Pot management',
    question: 'Can I add or remove members later?',
    answer:
      'Yes. Invite people at any time. A pot admin can remove a member. Their past contributions and expenses stay in the history so the balances remain accurate.',
  },
  {
    category: 'Account',
    question: 'What does it mean if a member is unlinked?',
    answer:
      'An unlinked member is a person in the Pot who has not connected a Potto account yet. You can still record their contributions and expenses. Linking an account lets them sign in and see the Pot themselves.',
  },
];

export function FaqBrowser() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [open, setOpen] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return `${item.question} ${item.answer}`.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search questions"
        aria-label="Search questions"
      />
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="FAQ categories">
        {CATEGORIES.map((item) => {
          const selected = category === item;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setCategory(item);
                setOpen(null);
              }}
              className={cn(
                'shrink-0 rounded-[10px] border px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                selected ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink-soft hover:text-ink',
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">No answers match that search.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
          {items.map((item) => {
            const id = `${item.category}-${item.question}`;
            const expanded = open === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${id}-answer`}
                  onClick={() => setOpen(expanded ? null : id)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30"
                >
                  <span>
                    <span className="block text-xs font-medium text-ink-soft">{item.category}</span>
                    <span className="mt-0.5 block font-sans text-[15px] font-semibold text-ink">{item.question}</span>
                  </span>
                  <span aria-hidden className="text-ink-soft">
                    {expanded ? '–' : '+'}
                  </span>
                </button>
                {expanded ? (
                  <p id={`${id}-answer`} className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">
                    {item.answer}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
