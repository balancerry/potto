import { notFound } from 'next/navigation';
import { CategoryManager } from '@/components/categories/category-manager';
import { countCategoryUsage } from '@/lib/core/logic/categories';
import { canManageCategories } from '@/lib/core/logic/permissions';
import { getPotBundle } from '@/lib/queries/pots';

export const metadata = { title: 'Categories' };

export default async function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPotBundle(id);
  if (!bundle) notFound();

  const canManage = canManageCategories(bundle.currentMember ?? undefined) && bundle.pot.status === 'active';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Categories</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {canManage
            ? 'Customize how expenses are organized in this Pot.'
            : 'How expenses are organized in this Pot. A pot admin can change these.'}
        </p>
      </div>
      <CategoryManager
        potId={id}
        categories={bundle.categories}
        usage={countCategoryUsage(bundle.transactions)}
        canManage={canManage}
      />
    </div>
  );
}
