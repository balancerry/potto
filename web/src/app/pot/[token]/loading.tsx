export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-label="Loading pot">
      <div className="space-y-4 rounded-[var(--radius-lg)] border border-line bg-surface p-6">
        <div className="h-5 w-24 rounded-full bg-surface-sunk" />
        <div className="h-9 w-2/3 rounded bg-surface-sunk" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-[var(--radius-md)] bg-surface-sunk" />
          ))}
        </div>
      </div>
      <div className="h-10 w-3/4 rounded-[var(--radius-md)] bg-surface-sunk/70" />
      <div className="h-64 rounded-[var(--radius-lg)] border border-line bg-surface-sunk/70" />
    </div>
  );
}
