'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Network / server failure while loading a public pot. `retry` (Next 16.3+) re-fetches the server render; `reset` would not. */
export default function PublicPotError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-12 text-center shadow-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-soft">
        We couldn&apos;t load this pot. Check your connection and try again.
      </p>
      <div className="mt-6 flex justify-center">
        <Button type="button" onClick={() => retry()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
