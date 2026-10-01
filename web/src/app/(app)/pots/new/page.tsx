import Link from 'next/link';
import { CreatePotForm } from '@/components/pot/create-pot-form';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Create pot' };

export default async function NewPotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('users').select('name').eq('id', user.id).maybeSingle()
    : { data: null };
  const creatorName = profile?.name ?? (user?.user_metadata?.name as string | undefined) ?? '';

  return (
    <div className="w-full max-w-[800px] space-y-6">
      <Link
        href="/"
        aria-label="Back to your pots"
        className="inline-flex min-h-11 items-center text-sm font-medium text-ink-soft hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        ← Your pots
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Create a pot</h1>
        <p className="mt-2 text-base text-ink-soft">Start a shared space for your trip, event, or group.</p>
      </div>
      <CreatePotForm creatorName={creatorName} />
    </div>
  );
}
