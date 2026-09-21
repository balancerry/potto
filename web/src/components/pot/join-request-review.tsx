'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { approveExistingMember, approveNewMember, rejectJoinRequest } from '@/lib/actions/members';
import { suggestMemberMatches } from '@/lib/core/logic/join-requests';
import type { JoinRequest, Member } from '@/lib/core/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function JoinRequestReview({
  potId,
  request,
  members,
}: {
  potId: string;
  request: JoinRequest;
  members: Member[];
}) {
  const router = useRouter();
  const unlinked = members.filter((m) => m.status === 'active' && !m.userId);
  const suggestions = useMemo(
    () => suggestMemberMatches(request.requestedName, unlinked),
    [request.requestedName, unlinked],
  );

  const [mode, setMode] = useState<'existing' | 'new'>(suggestions[0] ? 'existing' : 'new');
  const [memberId, setMemberId] = useState(suggestions[0]?.id ?? unlinked[0]?.id ?? '');
  const [displayName, setDisplayName] = useState(request.requestedName);
  const [accessLevel, setAccessLevel] = useState<'member' | 'view_only'>('member');
  const [loading, setLoading] = useState(false);

  const selectedMember = unlinked.find((m) => m.id === memberId);

  useEffect(() => {
    if (mode !== 'existing') return;
    // Prefer requested name so admin can keep "Sunil" when linking to "SK".
    setDisplayName(request.requestedName);
  }, [mode, memberId, request.requestedName]);

  const nameSuggestions = useMemo(() => {
    const names = [request.requestedName, selectedMember?.name].filter(
      (n): n is string => Boolean(n && n.trim()),
    );
    return [...new Set(names.map((n) => n.trim()))];
  }, [request.requestedName, selectedMember?.name]);

  if (request.status !== 'pending') {
    return (
      <Card>
        <CardTitle>Already reviewed</CardTitle>
        <CardDescription>This join request is {request.status}.</CardDescription>
        <Button className="mt-4" variant="outline" onClick={() => router.push(`/pots/${potId}/members`)}>
          Back to members
        </Button>
      </Card>
    );
  }

  async function onApprove() {
    const name = displayName.trim();
    if (!name) {
      toast.error('Enter a display name');
      return;
    }
    setLoading(true);
    const result =
      mode === 'existing'
        ? await approveExistingMember({
            potId,
            joinRequestId: request.id,
            memberId,
            displayName: name,
            accessLevel,
          })
        : await approveNewMember({
            potId,
            joinRequestId: request.id,
            displayName: name,
            accessLevel,
          });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Member approved');
    router.push(`/pots/${potId}/members`);
    router.refresh();
  }

  async function onReject() {
    if (!confirm('Reject this join request?')) return;
    setLoading(true);
    const result = await rejectJoinRequest({ potId, joinRequestId: request.id });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Request rejected');
    router.push(`/pots/${potId}/members`);
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardTitle>{request.requestedName}</CardTitle>
      <CardDescription>Approve by linking an existing unlinked member, or create a new one.</CardDescription>

      <div className="mt-6 flex gap-2">
        <Button
          size="sm"
          variant={mode === 'existing' ? 'primary' : 'outline'}
          onClick={() => setMode('existing')}
          disabled={unlinked.length === 0}
        >
          Link existing
        </Button>
        <Button
          size="sm"
          variant={mode === 'new' ? 'primary' : 'outline'}
          onClick={() => {
            setMode('new');
            setDisplayName(request.requestedName);
          }}
        >
          Create new
        </Button>
      </div>

      {mode === 'existing' ? (
        <div className="mt-4">
          <Label htmlFor="memberId">Member slot</Label>
          <select
            id="memberId"
            className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            {unlinked.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {suggestions.some((s) => s.id === m.id) ? ' (suggested)' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-4">
        <Label htmlFor="displayName">Display name in this pot</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How this person should appear"
        />
        {nameSuggestions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {nameSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                className="rounded-full border border-line bg-surface-sunk px-3 py-1 text-xs font-medium text-ink hover:border-accent hover:text-accent"
                onClick={() => setDisplayName(name)}
              >
                Use “{name}”
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-ink-soft">
          Choose the requester’s name, the existing member name, or type something else.
        </p>
      </div>

      <div className="mt-4">
        <Label htmlFor="access">Access level</Label>
        <select
          id="access"
          className="flex h-11 w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 text-sm"
          value={accessLevel}
          onChange={(e) => setAccessLevel(e.target.value as 'member' | 'view_only')}
        >
          <option value="member">Full member</option>
          <option value="view_only">View only</option>
        </select>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          onClick={() => void onApprove()}
          disabled={loading || !displayName.trim() || (mode === 'existing' && !memberId)}
        >
          {loading ? 'Working…' : 'Approve'}
        </Button>
        <Button variant="danger" onClick={() => void onReject()} disabled={loading}>
          Reject
        </Button>
      </div>
    </Card>
  );
}
