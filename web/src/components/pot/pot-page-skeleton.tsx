export function PotPageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-[var(--radius-lg)] border border-line bg-surface-sunk/70" />
        ))}
      </div>
      <div className="h-40 rounded-[var(--radius-lg)] border border-line bg-surface-sunk/70" />
      <div className="h-56 rounded-[var(--radius-lg)] border border-line bg-surface-sunk/70" />
    </div>
  );
}
