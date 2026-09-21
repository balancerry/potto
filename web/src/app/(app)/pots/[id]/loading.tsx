import { PotPageSkeleton } from '@/components/pot/pot-page-skeleton';

export default function PotLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-3 border-b border-line pb-4">
        <div className="h-4 w-20 rounded bg-surface-sunk" />
        <div className="h-8 w-48 rounded bg-surface-sunk" />
        <div className="flex gap-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-16 rounded bg-surface-sunk" />
          ))}
        </div>
      </div>
      <PotPageSkeleton />
    </div>
  );
}
