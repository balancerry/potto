import { notFound } from 'next/navigation';
import { SettingsForm } from '@/components/pot/settings-form';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink } from '@/components/ui/button';
import { canEditPot } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  if (!canEditPot(bundle.currentMember ?? undefined)) {
    return (
      <EmptyState
        title="Admins only"
        description="Only pot admins can change settings."
        action={<ButtonLink href={`/pots/${id}`}>Back to pot</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Settings</h2>
        <p className="mt-1 text-sm text-ink-soft">Update pot details or archive when you&apos;re done.</p>
      </div>
      <SettingsForm pot={bundle.pot} />
    </div>
  );
}
