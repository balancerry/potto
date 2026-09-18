import { createClient } from '@/lib/supabase/server';

export interface ResolvedPotSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  enabled: boolean;
  memberCount: number;
}

type InviteRpcRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  invite_enabled: boolean;
  member_count: number | string;
};

type JoinRpcRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  join_enabled: boolean;
  member_count: number | string;
};

export async function resolveInviteCode(code: string): Promise<ResolvedPotSummary | null> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return null;

  const supabase = await createClient();
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

export async function resolveJoinCode(code: string): Promise<ResolvedPotSummary | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;

  const supabase = await createClient();
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
