import { notFound } from 'next/navigation';
import { JoinPotFlow } from '@/components/pot/join-pot-flow';
import { resolveInviteCode } from '@/lib/queries/resolve';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Invite' };

export default async function InviteCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const pot = await resolveInviteCode(code);
  if (!pot) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialStatus: 'already_member' | 'already_pending' | null = null;
  let defaultName = '';

  if (user) {
    const { data: profile } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
    defaultName = profile?.name ?? (user.user_metadata?.name as string | undefined) ?? '';

    const { data: member } = await supabase
      .from('pot_members')
      .select('id')
      .eq('pot_id', pot.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (member) {
      initialStatus = 'already_member';
    } else {
      const { data: pending } = await supabase
        .from('join_requests')
        .select('id')
        .eq('pot_id', pot.id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (pending) initialStatus = 'already_pending';
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="font-display text-3xl font-semibold text-ink">You&apos;re invited</h1>
        <p className="mt-1 text-ink-soft">Join this pot with your Potto account.</p>
      </div>
      <JoinPotFlow
        pot={pot}
        channel="invite_link"
        defaultName={defaultName}
        initialStatus={initialStatus}
      />
    </div>
  );
}
