import { notFound } from 'next/navigation';
import { JoinPotFlow } from '@/components/pot/join-pot-flow';
import type { JoinChannel } from '@/lib/core/logic/join-requests';
import { resolveJoinCode } from '@/lib/queries/resolve';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Request to join' };

export default async function JoinPotPage({
  params,
  searchParams,
}: {
  params: Promise<{ potId: string }>;
  searchParams: Promise<{ channel?: string; code?: string }>;
}) {
  const { potId } = await params;
  const sp = await searchParams;
  const channel: JoinChannel = sp.channel === 'invite_link' ? 'invite_link' : 'join_code';
  const code = sp.code?.trim();

  if (!code) {
    notFound();
  }

  const pot = await resolveJoinCode(code);
  if (!pot || pot.id !== potId) notFound();

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
      .eq('pot_id', potId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (member) {
      initialStatus = 'already_member';
    } else {
      const { data: pending } = await supabase
        .from('join_requests')
        .select('id')
        .eq('pot_id', potId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (pending) initialStatus = 'already_pending';
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="font-display text-3xl font-semibold text-ink">Join pot</h1>
        <p className="mt-1 text-ink-soft">Review the pot and send a join request.</p>
      </div>
      <JoinPotFlow pot={pot} channel={channel} defaultName={defaultName} initialStatus={initialStatus} />
    </div>
  );
}
