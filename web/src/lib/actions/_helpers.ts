import { revalidatePath } from 'next/cache';
import type { Member } from '@/lib/core/models';
import { isAdmin, isActiveMember } from '@/lib/core/logic/permissions';
import { mapMember, type MemberRow } from '@/lib/mappers';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export async function requireUser(): Promise<
  { supabase: SupabaseClient; user: User } | { supabase: SupabaseClient; user: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: 'Please sign in to continue' };
  return { supabase, user };
}

/** Active pot_member for the signed-in user in this pot, or undefined. */
export async function getCurrentMember(
  supabase: SupabaseClient,
  potId: string,
  userId: string,
): Promise<Member | undefined> {
  const { data, error } = await supabase
    .from('pot_members')
    .select('*')
    .eq('pot_id', potId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapMember(data as MemberRow);
}

export function assertActiveMember(member: Member | undefined): Member {
  if (!isActiveMember(member)) {
    throw new Error('You are not a member of this pot');
  }
  return member;
}

export function assertAdmin(member: Member | undefined): Member {
  if (!member || !isAdmin(member)) {
    throw new Error('You do not have permission to do that');
  }
  return member;
}

export function revalidatePotPaths(potId: string) {
  revalidatePath('/');
  revalidatePath('/pots');
  revalidatePath(`/pots/${potId}`);
  revalidatePath(`/pots/${potId}`, 'layout');
}
