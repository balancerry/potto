import { JoinCodeForm } from '@/components/pot/join-code-form';

export const metadata = { title: 'Join a pot' };

export default function JoinPage() {
  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="font-display text-3xl font-semibold text-ink">Join a pot</h1>
        <p className="mt-1 text-ink-soft">Enter the join code shared by your group.</p>
      </div>
      <JoinCodeForm />
    </div>
  );
}
