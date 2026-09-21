import { Suspense } from 'react';
import { YourPotsDashboard } from '@/components/home/your-pots-dashboard';
import { PotCardSkeleton } from '@/components/home/pot-card';
import { listMyPots } from '@/lib/queries/pots';

export const metadata = { title: 'Your pots' };

function HomeSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-9 w-48 animate-pulse rounded bg-surface-sunk" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface-sunk" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-28 animate-pulse rounded-[var(--radius-md)] bg-surface-sunk" />
          <div className="h-11 w-32 animate-pulse rounded-[var(--radius-md)] bg-surface-sunk" />
        </div>
      </div>
      <div className="h-11 w-full animate-pulse rounded-[var(--radius-md)] bg-surface-sunk" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <PotCardSkeleton />
        <PotCardSkeleton />
        <PotCardSkeleton />
      </div>
    </div>
  );
}

async function YourPotsLoader() {
  const pots = await listMyPots();
  return <YourPotsDashboard items={pots} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <YourPotsLoader />
    </Suspense>
  );
}
