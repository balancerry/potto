'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowLeftRight, LayoutGrid, MoreHorizontal, UsersRound } from 'lucide-react';
import { PottoIcon } from '@/components/icons/potto-icon';
import { LinkPendingHint, useIsLinkPending } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TABS: { href: string; label: string; section: 'overview' | 'activity' | 'people' | 'settle'; icon: LucideIcon }[] = [
  { href: '', label: 'Overview', section: 'overview', icon: LayoutGrid },
  { href: '/transactions', label: 'Activity', section: 'activity', icon: Activity },
  { href: '/members', label: 'People', section: 'people', icon: UsersRound },
  { href: '/settle', label: 'Settle', section: 'settle', icon: ArrowLeftRight },
];

const MORE_PREFIXES = ['/more', '/commitments', '/invite', '/summary', '/pool', '/settings'];

function NavLinkLabel({ label, icon }: { label: string; icon: LucideIcon }) {
  const pending = useIsLinkPending();
  return (
    <span className="inline-flex items-center gap-1.5">
      <PottoIcon icon={icon} size={16} className="opacity-80" />
      {label}
      {pending ? <LinkPendingHint className="size-3" /> : null}
    </span>
  );
}

function sectionActive(pathname: string, base: string, section: (typeof TABS)[number]['section']): boolean {
  if (section === 'overview') return pathname === base;
  if (section === 'activity') return pathname === `${base}/transactions` || pathname.startsWith(`${base}/transactions/`);
  if (section === 'people') {
    return (
      pathname === `${base}/members` ||
      pathname.startsWith(`${base}/members/`) ||
      pathname === `${base}/balance` ||
      pathname.startsWith(`${base}/contributions/`) ||
      pathname.startsWith(`${base}/join-requests/`)
    );
  }
  return pathname === `${base}/settle` || pathname.startsWith(`${base}/edit-settlement`);
}

export function PotNav({ potId }: { potId: string }) {
  const pathname = usePathname();
  const base = `/pots/${potId}`;
  const moreActive = MORE_PREFIXES.some(
    (prefix) => pathname === `${base}${prefix}` || pathname.startsWith(`${base}${prefix}/`),
  );

  return (
    <nav aria-label="Pot" className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((link) => {
        const href = `${base}${link.href}`;
        const active = sectionActive(pathname, base, link.section);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              active ? 'bg-accent text-on-accent' : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
            )}
          >
            <NavLinkLabel label={link.label} icon={link.icon} />
          </Link>
        );
      })}
      <Link
        href={`${base}/more`}
        prefetch
        aria-current={moreActive ? 'page' : undefined}
        className={cn(
          'shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          moreActive ? 'bg-accent text-on-accent' : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
        )}
      >
        <NavLinkLabel label="More" icon={MoreHorizontal} />
      </Link>
    </nav>
  );
}
