'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { JoinChannel } from '@/lib/core/logic/join-requests';
import type { ResolvedPotSummary } from '@/lib/queries/resolve';
import { requestToJoin } from '@/lib/actions/members';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type View = 'summary' | 'identity' | 'pending' | 'already_member' | 'already_pending' | 'blocked';

const CHANNEL_NOUN: Record<JoinChannel, string> = {
  invite_link: 'invite',
  join_code: 'join code',
};

export function JoinPotFlow({
  pot,
  channel,
  defaultName = '',
  initialStatus,
}: {
  pot: ResolvedPotSummary;
  channel: JoinChannel;
  defaultName?: string;
  initialStatus?: 'already_member' | 'already_pending' | null;
}) {
  const router = useRouter();
  const noun = CHANNEL_NOUN[channel];

  const [view, setView] = useState<View>(() => {
    if (pot.status === 'archived' || !pot.enabled) return 'blocked';
    if (initialStatus === 'already_member') return 'already_member';
    if (initialStatus === 'already_pending') return 'already_pending';
    return 'summary';
  });
  const [requestedName, setRequestedName] = useState(defaultName);
  const [loading, setLoading] = useState(false);

  async function sendRequest() {
    if (!requestedName.trim()) {
      toast.error('Enter your name');
      return;
    }
    setLoading(true);
    const result = await requestToJoin(pot.id, requestedName.trim(), channel);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.status === 'already_member') {
      setView('already_member');
      return;
    }
    if (result.data.status === 'already_pending') {
      setView('already_pending');
      return;
    }
    setView('pending');
    router.refresh();
  }

  if (view === 'blocked') {
    return (
      <EmptyState
        title="Can't join this pot"
        description={
          pot.status === 'archived'
            ? 'This pot is archived and no longer accepts members.'
            : `This ${noun} is disabled. Ask an admin for a new one.`
        }
        action={<ButtonLink href="/">Back home</ButtonLink>}
      />
    );
  }

  if (view === 'already_member') {
    return (
      <EmptyState
        title="You're already in"
        description={`${pot.name} is already on your list.`}
        action={<ButtonLink href={`/pots/${pot.id}`}>Open pot</ButtonLink>}
      />
    );
  }

  if (view === 'already_pending' || view === 'pending') {
    return (
      <EmptyState
        title="Request sent"
        description={`Your request to join ${pot.name} is waiting for admin approval.`}
        action={<ButtonLink href="/">Back home</ButtonLink>}
      />
    );
  }

  if (view === 'identity') {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardTitle>How should we identify you?</CardTitle>
        <CardDescription>The pot admin will review your request before giving access.</CardDescription>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendRequest();
          }}
        >
          <div>
            <Label htmlFor="requestedName">Your name</Label>
            <Input
              id="requestedName"
              value={requestedName}
              onChange={(e) => setRequestedName(e.target.value)}
              placeholder="Display name in this pot"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send join request'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setView('summary')}>
              Back
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardTitle>{pot.name}</CardTitle>
      <CardDescription>
        {pot.description?.trim() || `You've been invited to join this pot via ${noun}.`}
      </CardDescription>
      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-[var(--radius-md)] bg-surface-sunk p-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-soft">Members</dt>
          <dd className="font-display text-2xl font-semibold text-ink">{pot.memberCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-soft">Status</dt>
          <dd className="font-display text-2xl font-semibold capitalize text-ink">{pot.status}</dd>
        </div>
      </dl>
      <Button className="mt-6 w-full" onClick={() => setView('identity')}>
        Request to join
      </Button>
    </Card>
  );
}
