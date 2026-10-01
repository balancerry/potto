import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SettingsForm } from '@/components/pot/settings-form';
import { canDeletePot, canEditPot } from '@/lib/core/logic/permissions';
import { getActiveCategories } from '@/lib/core/logic/categories';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Pot settings' };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const admin = canEditPot(bundle.currentMember ?? undefined);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Pot settings</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Name, description, and the expected contribution. Pool money lives in{' '}
          <Link href={`/pots/${id}/pool`} className="font-medium text-accent hover:underline">
            Pool management
          </Link>
          .
        </p>
      </div>
      <Link
        href={`/pots/${id}/settings/categories`}
        className="flex max-w-lg items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-4 py-3 hover:bg-surface-sunk/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <span>
          <span className="block font-medium text-ink">Categories</span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            {getActiveCategories(bundle.categories).length} active · Customize how expenses are organized
          </span>
        </span>
        <span aria-hidden className="text-ink-soft">›</span>
      </Link>
      {admin ? (
        <SettingsForm pot={bundle.pot} canDelete={canDeletePot(bundle.currentMember ?? undefined)} />
      ) : (
        <p className="max-w-lg text-sm text-ink-soft">Pot settings are managed by a pot admin.</p>
      )}
    </div>
  );
}
