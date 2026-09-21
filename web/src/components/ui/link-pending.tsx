'use client';

import { useLinkStatus } from 'next/link';
import { cn } from '@/lib/utils';

/** Must be rendered as a child of `next/link` Link. */
export function LinkPendingHint({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}

export function useIsLinkPending() {
  return useLinkStatus().pending;
}
