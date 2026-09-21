import { supabase } from '@/lib/supabase';

export type ResolvedPotSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  enabled: boolean;
  memberCount: number;
};

type JoinRpcRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  join_enabled: boolean;
  member_count: number | string;
};

type InviteRpcRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  invite_enabled: boolean;
  member_count: number | string;
};

/** Look up a pot by join code — works even when the caller is not a member. */
export async function resolveJoinCodeRemote(code: string): Promise<ResolvedPotSummary | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc('resolve_join_code', { p_code: trimmed });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as JoinRpcRow | null | undefined;
  if (!row?.id) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    enabled: Boolean(row.join_enabled),
    memberCount: Number(row.member_count),
  };
}

/** Look up a pot by invite-link code — works even when the caller is not a member. */
export async function resolveInviteCodeRemote(code: string): Promise<ResolvedPotSummary | null> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc('resolve_invite_code', { p_code: trimmed });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as InviteRpcRow | null | undefined;
  if (!row?.id) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    enabled: Boolean(row.invite_enabled),
    memberCount: Number(row.member_count),
  };
}

export async function getJoinStatusForPot(
  potId: string,
): Promise<'already_member' | 'already_pending' | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('pot_members')
    .select('id')
    .eq('pot_id', potId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (member) return 'already_member';

  const { data: pending } = await supabase
    .from('join_requests')
    .select('id')
    .eq('pot_id', potId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (pending) return 'already_pending';

  return null;
}
