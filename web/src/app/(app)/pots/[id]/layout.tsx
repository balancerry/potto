import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PotNav } from '@/components/pot/pot-nav';
import { Badge } from '@/components/ui/badge';
import { isAdmin } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export default async function PotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const { pot, currentMember } = bundle;
  const admin = isAdmin(currentMember ?? undefined);

  return (
    <div className="space-y-6">
      <div className="space-y-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/" className="text-sm text-ink-soft hover:text-accent">
              ← All pots
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{pot.name}</h1>
              {pot.status === 'archived' ? <Badge tone="gold">Archived</Badge> : null}
            </div>
            {pot.description ? <p className="mt-1 max-w-2xl text-sm text-ink-soft">{pot.description}</p> : null}
          </div>
        </div>
        <PotNav potId={id} isAdmin={admin} />
      </div>
      {children}
    </div>
  );
}
