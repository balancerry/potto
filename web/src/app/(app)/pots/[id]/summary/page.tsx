import { notFound } from 'next/navigation';
import { SummaryView } from '@/components/pot/summary-view';
import { buildPotSummaryViewModel } from '@/lib/core/logic/pot-summary';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Summary' };

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const vm = buildPotSummaryViewModel(
    bundle.pot,
    bundle.transactions,
    bundle.commitments,
    bundle.commitmentPayments,
  );

  return <SummaryView vm={vm} />;
}
