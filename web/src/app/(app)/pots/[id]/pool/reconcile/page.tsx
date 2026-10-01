import { notFound } from 'next/navigation';
import { ReconcileForm } from '@/components/pot/reconcile-form';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Reconcile' };

export default async function ReconcilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-2xl font-semibold text-ink">Reconcile</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Compare what Potto has recorded with the cash and bank you can see. This does not change any transactions.
        </p>
      </div>
      <ReconcileForm potId={id} accounts={bundle.poolAccounts} transactions={bundle.transactions} />
    </div>
  );
}
