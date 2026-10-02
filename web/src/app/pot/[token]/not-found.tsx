import { Link2Off } from 'lucide-react';
import { PottoIcon } from '@/components/icons/potto-icon';

/** Unknown or malformed token. Reveals nothing about whether any pot exists. */
export default function PublicPotNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-12 text-center shadow-sm">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-sunk text-ink-soft">
        <PottoIcon icon={Link2Off} size={20} />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Pot not found</h1>
      <p className="mt-2 text-sm text-ink-soft">This public pot link may be invalid or expired.</p>
    </div>
  );
}
