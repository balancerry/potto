'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LinkPendingHint, useIsLinkPending } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '', label: 'Home', match: 'exact' as const },
  { href: '/transactions', label: 'Activity', match: 'prefix' as const },
  { href: '/settle', label: 'Settle', match: 'exact' as const },
  { href: '/commitments', label: 'Upcoming', match: 'prefix' as const },
  { href: '/members', label: 'Members', match: 'prefix' as const },
  { href: '/invite', label: 'Invite', match: 'exact' as const },
  { href: '/summary', label: 'Summary', match: 'exact' as const },
  { href: '/settings', label: 'Settings', match: 'exact' as const, adminOnly: true },
];

function NavLinkLabel({ label }: { label: string }) {
  const pending = useIsLinkPending();
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {pending ? <LinkPendingHint className="size-3" /> : null}
    </span>
  );
}

export function PotNav({ potId, isAdmin }: { potId: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/pots/${potId}`;

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
      {LINKS.filter((l) => !l.adminOnly || isAdmin).map((link) => {
        const href = `${base}${link.href}`;
        const active =
          link.match === 'exact'
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={cn(
              'shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-white' : 'text-ink-soft hover:bg-surface-sunk hover:text-ink',
            )}
          >
            <NavLinkLabel label={link.label} />
          </Link>
        );
      })}
    </nav>
  );
}
