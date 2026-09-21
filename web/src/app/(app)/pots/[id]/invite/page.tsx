import { notFound } from 'next/navigation';
import { InvitePanel } from '@/components/pot/invite-panel';
import { canInvite, isAdmin } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Invite' };

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  if (!canInvite(bundle.currentMember ?? undefined)) {
    return (
      <EmptyState
        title="Can't invite"
        description="You don't have permission to share invites for this pot."
        action={<ButtonLink href={`/pots/${id}`}>Back to pot</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Invite people</h2>
        <p className="mt-1 text-sm text-ink-soft">Share the join code or QR. Admins approve requests.</p>
      </div>
      <InvitePanel pot={bundle.pot} isAdmin={isAdmin(bundle.currentMember ?? undefined)} />
    </div>
  );
}
