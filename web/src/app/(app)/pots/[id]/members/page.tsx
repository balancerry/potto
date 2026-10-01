import { notFound } from 'next/navigation';
import { MembersList } from '@/components/pot/members-list';
import { isAdmin } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'People' };

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const pending = bundle.joinRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">People</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {bundle.members.filter((m) => m.status === 'active').length} active members
          {pending.length > 0 ? ` · ${pending.length} join ${pending.length === 1 ? 'request' : 'requests'}` : ''}
        </p>
      </div>
      <MembersList
        potId={id}
        members={bundle.members}
        transactions={bundle.transactions}
        pendingRequests={pending}
        isAdmin={isAdmin(bundle.currentMember ?? undefined)}
      />
    </div>
  );
}
