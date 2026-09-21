-- Fix pot deletion: child rows reference pot_members without ON DELETE CASCADE,
-- so deleting a pot (which cascades to members) fails when splits/txs still point
-- at those members. Provide an ordered delete_pot RPC and harden the splits FK.

-- ---------------------------------------------------------------------------
-- Harden FKs that block member/pot cleanup
-- ---------------------------------------------------------------------------
alter table public.transaction_splits
  drop constraint if exists transaction_splits_member_id_fkey;

alter table public.transaction_splits
  add constraint transaction_splits_member_id_fkey
  foreign key (member_id) references public.pot_members(id) on delete cascade;

alter table public.transactions
  drop constraint if exists transactions_paid_by_fkey;

alter table public.transactions
  add constraint transactions_paid_by_fkey
  foreign key (paid_by) references public.pot_members(id) on delete set null;

alter table public.transactions
  drop constraint if exists transactions_to_member_fkey;

alter table public.transactions
  add constraint transactions_to_member_fkey
  foreign key (to_member) references public.pot_members(id) on delete set null;

alter table public.join_requests
  drop constraint if exists join_requests_linked_member_id_fkey;

alter table public.join_requests
  add constraint join_requests_linked_member_id_fkey
  foreign key (linked_member_id) references public.pot_members(id) on delete set null;

alter table public.join_requests
  drop constraint if exists join_requests_reviewed_by_fkey;

alter table public.join_requests
  add constraint join_requests_reviewed_by_fkey
  foreign key (reviewed_by) references public.pot_members(id) on delete set null;

-- created_by is NOT NULL on transactions/commitments — cannot SET NULL.
-- delete_pot below removes those rows before members.

-- ---------------------------------------------------------------------------
-- Ordered pot delete (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.delete_pot(p_pot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_pot_admin(p_pot_id) then
    raise exception 'Only admins can delete this pot';
  end if;

  delete from public.commitment_payments where pot_id = p_pot_id;
  delete from public.commitments where pot_id = p_pot_id;

  delete from public.transaction_splits
  where transaction_id in (select id from public.transactions where pot_id = p_pot_id);

  delete from public.transactions where pot_id = p_pot_id;

  update public.join_requests
  set linked_member_id = null, reviewed_by = null
  where pot_id = p_pot_id;

  delete from public.join_requests where pot_id = p_pot_id;
  delete from public.pot_members where pot_id = p_pot_id;
  delete from public.pots where id = p_pot_id;
end;
$$;

revoke all on function public.delete_pot(uuid) from public;
grant execute on function public.delete_pot(uuid) to authenticated;
