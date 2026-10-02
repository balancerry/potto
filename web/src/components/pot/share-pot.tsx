'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Copy, ExternalLink, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PottoIcon } from '@/components/icons/potto-icon';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { disablePublicShare, enablePublicShare, getPublicShare } from '@/lib/actions/public-share';
import {
  buildPublicPotUrl,
  buildShareMessage,
  publicPotPath,
  type PublicShareState,
} from '@/lib/core/logic/public-pot';
import { cn } from '@/lib/utils';

const noopSubscribe = () => () => {};

/** Origin used in shared links: the configured site URL, else wherever this page is served from. */
function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

function useShareUrl(token: string | null): string | null {
  const origin = useSyncExternalStore(noopSubscribe, siteOrigin, () => process.env.NEXT_PUBLIC_SITE_URL ?? '');
  return token && origin ? buildPublicPotUrl(origin, token) : null;
}

const hasNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Public sharing controls for one pot: turn the read-only link on/off, copy it,
 * share it. Any member sees the link once it is on; only owners/admins can
 * change it (the database enforces that, this just hides what would fail).
 *
 * Pass `initial` when the server already has the state; otherwise it is loaded
 * on mount.
 */
export function SharePanel({
  potId,
  potName,
  initial,
  className,
}: {
  potId: string;
  potName: string;
  initial?: PublicShareState;
  className?: string;
}) {
  const [state, setState] = useState<PublicShareState | null>(initial ?? null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<'enable' | 'disable' | null>(null);
  const nativeShare = useSyncExternalStore(noopSubscribe, hasNativeShare, () => false);
  const url = useShareUrl(state?.token ?? null);

  const load = useCallback(async () => {
    setLoadError(false);
    const result = await getPublicShare(potId);
    if (result.ok) setState(result.data);
    else setLoadError(true);
  }, [potId]);

  useEffect(() => {
    if (initial) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch when the server did not preload
    void load();
  }, [initial, load]);

  async function enable() {
    setBusy('enable');
    const result = await enablePublicShare(potId);
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    setState(result.data);
    toast.success('Public sharing is on');
  }

  async function disable() {
    if (
      !confirm(
        'Turn off public sharing? The current link stops working immediately for everyone, and turning it back on creates a new link.',
      )
    ) {
      return;
    }
    setBusy('disable');
    const result = await disablePublicShare(potId);
    setBusy(null);
    if (!result.ok) return void toast.error(result.error);
    setState(result.data);
    toast.success('Public sharing is off');
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it manually');
    }
  }

  async function share() {
    if (!url) return;
    const message = buildShareMessage(potName);
    if (nativeShare) {
      try {
        await navigator.share({ title: potName, text: message, url });
      } catch (err) {
        // Dismissing the share sheet is not an error.
        if (!(err instanceof DOMException && err.name === 'AbortError')) toast.error('Could not open the share sheet');
      }
      return;
    }
    // No system share sheet (most desktop browsers): WhatsApp is how groups here pass links around.
    window.open(`https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`, '_blank', 'noopener,noreferrer');
  }

  if (loadError) {
    return (
      <Card className={className}>
        <CardTitle className="text-base">Public sharing</CardTitle>
        <CardDescription>We couldn&apos;t load the sharing settings.</CardDescription>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card className={cn('animate-pulse', className)} aria-busy="true" aria-label="Loading sharing settings">
        <div className="h-5 w-32 rounded bg-surface-sunk" />
        <div className="mt-3 h-4 w-3/4 rounded bg-surface-sunk" />
        <div className="mt-5 h-10 w-40 rounded-[var(--radius-md)] bg-surface-sunk" />
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <CardTitle className="text-base">Public sharing</CardTitle>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            state.enabled ? 'bg-pos-soft text-pos' : 'bg-surface-sunk text-ink-soft',
          )}
        >
          <span aria-hidden className={cn('size-1.5 rounded-full', state.enabled ? 'bg-pos' : 'bg-ink-soft/60')} />
          {state.enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {state.enabled && url ? (
        <>
          <CardDescription>
            Anyone with this link can view {potName} without joining or signing up. They can&apos;t change anything.
          </CardDescription>
          <input
            readOnly
            value={url}
            aria-label="Public link"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-4 h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface-sunk px-3 font-sans text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copy()}>
              <PottoIcon icon={Copy} size={16} />
              Copy link
            </Button>
            <Button size="sm" variant="outline" onClick={() => void share()}>
              <PottoIcon icon={Share2} size={16} />
              Share
            </Button>
            <a
              href={`${publicPotPath(state.token ?? '')}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-ink-soft hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <PottoIcon icon={ExternalLink} size={16} />
              Preview
            </a>
          </div>
          {state.canManage ? (
            <div className="mt-5 border-t border-line pt-4">
              <Button variant="outline" size="sm" className="border-neg text-neg" disabled={busy !== null} onClick={() => void disable()}>
                {busy === 'disable' ? 'Turning off…' : 'Disable public sharing'}
              </Button>
              <p className="mt-2 text-xs text-ink-soft">
                The link stops working right away. Turning sharing back on creates a new link.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <CardDescription>Anyone with the link can view this pot without joining.</CardDescription>
          {state.canManage ? (
            <Button className="mt-4" disabled={busy !== null} onClick={() => void enable()}>
              {busy === 'enable' ? 'Turning on…' : 'Enable sharing'}
            </Button>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">Sharing is off. A pot admin can turn it on.</p>
          )}
          <p className="mt-3 text-xs text-ink-soft">
            Viewers see names and amounts only. No emails, phone numbers or notes.
          </p>
        </>
      )}
    </Card>
  );
}

/** "Share" button for the pot header; opens the sharing controls in a dialog. */
export function SharePotButton({ potId, potName }: { potId: string; potName: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <Button ref={triggerRef} variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <PottoIcon icon={Share2} size={16} />
        Share
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 sm:items-center sm:p-4"
          onMouseDown={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-pot-title"
            onMouseDown={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-lg)] border border-line bg-surface p-5 shadow-lg sm:rounded-[var(--radius-lg)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="share-pot-title" className="min-w-0 truncate font-sans text-lg font-semibold text-ink">
                Share {potName}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <PottoIcon icon={X} size={18} />
              </button>
            </div>
            <SharePanel potId={potId} potName={potName} className="mt-4 border-0 p-0 shadow-none" />
          </div>
        </div>
      ) : null}
    </>
  );
}
