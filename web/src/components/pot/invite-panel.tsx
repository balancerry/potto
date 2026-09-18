'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import {
  regenerateInviteCode,
  regenerateJoinCode,
  setInviteEnabled,
  setJoinEnabled,
} from '@/lib/actions/pots';
import { buildJoinCodePayload } from '@/lib/core/logic/invites';
import type { Pot } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

async function copyText(label: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy');
  }
}

export function InvitePanel({ pot, isAdmin, siteUrl }: { pot: Pot; isAdmin: boolean; siteUrl: string }) {
  const router = useRouter();
  const inviteUrl = `${siteUrl.replace(/\/$/, '')}/invite/${pot.inviteCode}`;
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>) {
    setBusy(key);
    const result = await fn();
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Updated');
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardTitle>Invite link</CardTitle>
        <CardDescription>Share this link so people can request to join.</CardDescription>
        <p className="mt-4 break-all rounded-[var(--radius-md)] bg-surface-sunk px-3 py-2 font-mono text-sm">
          {inviteUrl}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void copyText('Invite link', inviteUrl)}>
            Copy link
          </Button>
          {isAdmin ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  void run('invite-toggle', () => setInviteEnabled(pot.id, !pot.inviteEnabled))
                }
              >
                {pot.inviteEnabled ? 'Disable link' : 'Enable link'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void run('invite-regen', () => regenerateInviteCode(pot.id))}
              >
                Regenerate
              </Button>
            </>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Status: {pot.inviteEnabled ? 'Enabled' : 'Disabled'} · Code: {pot.inviteCode}
        </p>
      </Card>

      <Card>
        <CardTitle>Join code & QR</CardTitle>
        <CardDescription>Short code for in-person joining.</CardDescription>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-[var(--radius-md)] border border-line bg-white p-3">
            <QRCodeSVG value={buildJoinCodePayload(pot.joinCode)} size={140} />
          </div>
          <div>
            <p className="font-display text-3xl font-semibold tracking-widest text-ink">{pot.joinCode}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void copyText('Join code', pot.joinCode)}>
                Copy code
              </Button>
              {isAdmin ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      void run('join-toggle', () => setJoinEnabled(pot.id, !pot.joinEnabled))
                    }
                  >
                    {pot.joinEnabled ? 'Disable code' : 'Enable code'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => void run('join-regen', () => regenerateJoinCode(pot.id))}
                  >
                    Regenerate
                  </Button>
                </>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Status: {pot.joinEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
