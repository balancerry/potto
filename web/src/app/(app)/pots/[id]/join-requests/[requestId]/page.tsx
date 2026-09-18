import { notFound } from 'next/navigation';
import { JoinRequestReview } from '@/components/pot/join-request-review';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canReviewJoinRequests } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Join request' };

export default async function JoinRequestPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>;
}) {
  const { id, requestId } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  if (!canReviewJoinRequests(bundle.currentMember ?? undefined)) {
    return (
      <EmptyState
        title="Admins only"
        description="Only pot admins can review join requests."
        action={<ButtonLink href={`/pots/${id}`}>Back to pot</ButtonLink>}
      />
    );
  }

  const request = bundle.joinRequests.find((r) => r.id === requestId);
  if (!request) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Review join request</h2>
        <p className="mt-1 text-sm text-ink-soft">Decide how this person joins the pot.</p>
      </div>
      <JoinRequestReview potId={id} request={request} members={bundle.members} />
    </div>
  );
}
