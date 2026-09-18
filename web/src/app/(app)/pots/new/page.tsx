import { CreatePotForm } from '@/components/pot/create-pot-form';

export const metadata = { title: 'Create pot' };

export default function NewPotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Create a pot</h1>
        <p className="mt-1 text-ink-soft">Set up a shared fund for your trip or event.</p>
      </div>
      <CreatePotForm />
    </div>
  );
}
