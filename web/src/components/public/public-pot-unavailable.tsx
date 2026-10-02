import { EyeOff } from 'lucide-react';
import { PottoIcon } from '@/components/icons/potto-icon';

/** Link that existed but whose owner turned sharing off. Shows no pot data at all. */
export function PublicPotUnavailable() {
  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-12 text-center shadow-sm">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
        <PottoIcon icon={EyeOff} size={20} />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
        This pot is no longer publicly available.
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Its owner turned off sharing. If you still need to see it, ask them to share a new link.
      </p>
    </div>
  );
}
