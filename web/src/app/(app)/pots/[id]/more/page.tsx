import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPotShell } from '@/lib/queries/pots';

export const metadata = { title: 'More' };

const GROUPS = [
  {
    title: 'Plan',
    items: [
      { href: '/commitments', label: 'Planned payments', detail: 'Payments you plan to make. They are not spent until recorded.' },
      { href: '/invite', label: 'Invite people', detail: 'Share the Pot so others can join.' },
    ],
  },
  {
    title: 'Money',
    items: [
      { href: '/pool', label: 'Pool management', detail: 'See the shared pool, move money, and reconcile bank and cash.' },
    ],
  },
  {
    title: 'Review',
    items: [{ href: '/summary', label: 'Summary', detail: 'The full picture of this Pot.' }],
  },
  {
    title: 'Manage',
    items: [
      { href: '/settings', label: 'Pot settings', detail: 'Name, description, categories, and archive or delete.' },
      { href: '/settings/categories', label: 'Categories', detail: 'Customize how expenses are organized in this Pot.' },
    ],
  },
] as const;

export default async function MorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shell = await getPotShell(id);
  if (!shell) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">More</h2>
        <p className="mt-1 text-sm text-ink-soft">Planning, pool money, the summary, and settings for this Pot.</p>
      </div>
      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{group.title}</h3>
          <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={`/pots/${id}${item.href}`}
                  className="block px-4 py-3 hover:bg-surface-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                >
                  <span className="block font-medium text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{item.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
