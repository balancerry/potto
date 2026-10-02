import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PottoIcon } from '@/components/icons/potto-icon';
import { PotNav } from '@/components/pot/pot-nav';
import { PotWayfinding } from '@/components/pot/pot-wayfinding';
import { PotPageSkeleton } from '@/components/pot/pot-page-skeleton';
import { PotRealtime } from '@/components/pot/pot-realtime';
import { RecordPotVisit } from '@/components/pot/record-pot-visit';
import { SharePotButton } from '@/components/pot/share-pot';
import { Badge } from '@/components/ui/badge';
import { getPotShell } from '@/lib/queries/pots';

export default async function PotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shell = await getPotShell(id);
  if (!shell) notFound();

  const { pot, poolManagerName, activeMemberCount } = shell;
  const peopleLabel = `${activeMemberCount} ${activeMemberCount === 1 ? 'person' : 'people'}`;
  const contextLine = poolManagerName ? `${peopleLabel} · ${poolManagerName} manages the pool` : peopleLabel;

  return (
    <div className="space-y-6">
      <RecordPotVisit potId={id} />
      <PotRealtime potId={id} />
      <div className="space-y-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/"
              aria-label="Back to your pots"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <PottoIcon icon={ArrowLeft} size={18} />
              Your pots
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{pot.name}</h1>
              {pot.status === 'archived' ? <Badge tone="gold">Archived</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{contextLine}</p>
          </div>
          <SharePotButton potId={id} potName={pot.name} />
        </div>
        <PotNav potId={id} />
      </div>
      <Suspense fallback={null}>
        <PotWayfinding potId={id} potName={pot.name} />
      </Suspense>
      <Suspense fallback={<PotPageSkeleton />}>{children}</Suspense>
    </div>
  );
}
