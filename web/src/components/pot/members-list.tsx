'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { removeMember } from '@/lib/actions/members';
import type { JoinRequest, Member } from '@/lib/core/models';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function MembersList({
  potId,
  members,
  pendingRequests,
  isAdmin,
}: {
  potId: string;
  members: Member[];
  pendingRequests: JoinRequest[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.status === 'active');
  const inactive = members.filter((m) => m.status === 'inactive');

  async function onRemove(memberId: string, name: string) {
    if (!confirm(`Remove ${name} from this pot? Their history stays for balances.`)) return;
    const result = await removeMember(potId, memberId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Member removed');
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {isAdmin && pendingRequests.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">Pending join requests</h3>
          <ul className="grid gap-3">
            {pendingRequests.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-ink">{r.requestedName}</p>
                    <p className="text-xs text-ink-soft">Waiting for review</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/pots/${potId}/join-requests/${r.id}`)}
                  >
                    Review
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold text-ink">Active members</h3>
        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-line md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-sunk text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Linked</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {active.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                  <td className="px-4 py-3 capitalize">{m.role}</td>
                  <td className="px-4 py-3">{m.accessLevel === 'view_only' ? 'View only' : 'Member'}</td>
                  <td className="px-4 py-3">{m.userId ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/pots/${potId}/balance?memberId=${m.id}`}
                        className="text-accent hover:underline"
                      >
                        Balance
                      </Link>
                      {isAdmin && m.role !== 'admin' ? (
                        <button
                          type="button"
                          className="text-neg hover:underline"
                          onClick={() => void onRemove(m.id, m.name)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <ul className="grid gap-3 md:hidden">
          {active.map((m) => (
            <li key={m.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{m.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>{m.role}</Badge>
                      {m.accessLevel === 'view_only' ? <Badge tone="gold">View only</Badge> : null}
                      {!m.userId ? <Badge tone="default">Unlinked</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-sm">
                  <Link href={`/pots/${potId}/balance?memberId=${m.id}`} className="text-accent">
                    Balance
                  </Link>
                  {isAdmin && m.role !== 'admin' ? (
                    <button
                      type="button"
                      className="text-neg"
                      onClick={() => void onRemove(m.id, m.name)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {inactive.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">Inactive</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {inactive.map((m) => (
              <li key={m.id} className="flex justify-between gap-2 rounded-[var(--radius-md)] bg-surface-sunk px-3 py-2">
                <span>{m.name}</span>
                <Link href={`/pots/${potId}/balance?memberId=${m.id}`} className="text-accent">
                  Balance
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
