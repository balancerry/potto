'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { regenerateJoinCode, setJoinEnabled } from '@/lib/actions/pots';
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

export function InvitePanel({ pot, isAdmin }: { pot: Pot; isAdmin: boolean }) {
  const router = useRouter();
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
    <Card className="max-w-xl">
      <CardTitle>Join code & QR</CardTitle>
      <CardDescription>Share the code or QR so people can request to join.</CardDescription>
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
                  onClick={() => void run('join-toggle', () => setJoinEnabled(pot.id, !pot.joinEnabled))}
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
          <p className="mt-3 text-xs text-ink-soft">Status: {pot.joinEnabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
    </Card>
  );
}
