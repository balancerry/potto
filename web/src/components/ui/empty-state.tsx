import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line bg-surface/60 px-6 py-14 text-center',
        className,
      )}
    >
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
