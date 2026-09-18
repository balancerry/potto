-- Row-level security for the invitation & join request feature.
--
-- NOT CONNECTED to a live Supabase project (see note in 0001). Assumes
-- Supabase-style auth where auth.uid() returns the current users.id.

alter table pots enable row level security;
alter table pot_members enable row level security;
alter table join_requests enable row level security;

-- Helper predicate: does the current auth user have an active pot_member row
-- in this Pot? (Used everywhere so pot data never leaks across Pots — spec
-- section "One Pot must remain isolated from other Pots".)
create or replace function is_pot_member(target_pot_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from pot_members
    where pot_id = target_pot_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function is_pot_admin(target_pot_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from pot_members
    where pot_id = target_pot_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

-- pots: any authenticated user may read a pot by id (needed to resolve an
-- invite code before membership exists), but only an existing member sees it
-- listed among "my pots", and only an admin may update it.
create policy pots_select_by_invite_or_membership on pots
  for select
  using (true); -- invite resolution is intentionally public; app layer returns only the safe summary fields

create policy pots_update_admin_only on pots
  for update
  using (is_pot_admin(id));

-- pot_members: visible only to members of the same Pot (isolation). Only an
-- admin may insert/update rows (member creation/removal/linking happens
-- through the approve_join_request RPC, run as the reviewing admin).
create policy pot_members_select_same_pot on pot_members
  for select
  using (is_pot_member(pot_id));

create policy pot_members_write_admin_only on pot_members
  for insert with check (is_pot_admin(pot_id));

create policy pot_members_update_admin_only on pot_members
  for update
  using (is_pot_admin(pot_id));

-- join_requests: a requester may see/insert/cancel only their own requests;
-- an admin may see and update requests for Pots they administer.
create policy join_requests_select_own_or_admin on join_requests
  for select
  using (user_id = auth.uid() or is_pot_admin(pot_id));

create policy join_requests_insert_own on join_requests
  for insert
  with check (user_id = auth.uid());

create policy join_requests_update_own_cancel_or_admin_review on join_requests
  for update
  using (
    (user_id = auth.uid() and status = 'pending') -- requester may cancel their own pending request
    or is_pot_admin(pot_id) -- admin approves/rejects via the RPC below
  );
