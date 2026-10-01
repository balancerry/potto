'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';

let skipUnsavedWarn = false;

export function useWarnUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      if (skipUnsavedWarn) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);
}

export function UnsavedDialog({
  open,
  onStay,
  onDiscard,
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onKeyDown={(event) => event.key === 'Escape' && onStay()}>
      <div role="dialog" aria-modal="true" aria-labelledby="unsaved-title" className="w-full max-w-sm rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-lg">
        <h2 id="unsaved-title" className="font-sans text-xl font-semibold text-ink">
          Unsaved changes
        </h2>
        <p className="mt-2 text-sm text-ink-soft">You have changes that haven&apos;t been saved.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onStay}>
            Stay
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            Discard changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CancelLink({
  href,
  dirty,
  children,
  className,
}: {
  href: string;
  dirty: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!dirty) {
    return (
      <ButtonLink href={href} variant="outline" className={className}>
        {children}
      </ButtonLink>
    );
  }
  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <UnsavedDialog
        open={open}
        onStay={() => setOpen(false)}
        onDiscard={() => {
          skipUnsavedWarn = true;
          router.push(href);
        }}
      />
    </>
  );
}
