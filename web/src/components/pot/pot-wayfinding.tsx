'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolvePotTrail } from '@/lib/navigation/pot-trail';

export function PotWayfinding({ potId, potName }: { potId: string; potName: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const trail = resolvePotTrail(pathname, potId, potName, {
    from: search.get('from'),
    txId: search.get('txId'),
    edit: search.get('edit'),
  });
  if (!trail) return null;

  return (
    <div className="space-y-1">
      <Link
        href={trail.parent.href}
        aria-label={`Back to ${trail.parent.label}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-ink-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
      >
        ← {trail.parent.label}
      </Link>
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
          {trail.crumbs.map((crumb, index) => (
            <li key={`${crumb.href}-${crumb.label}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden>›</span> : null}
              <Link href={crumb.href} className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                {crumb.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
