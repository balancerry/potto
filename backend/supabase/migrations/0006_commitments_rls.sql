-- Row-level security for Commitments ("Upcoming Payments").
--
-- NOT CONNECTED to a live Supabase project (see note in 0001). Reuses the
-- is_pot_member / is_pot_admin helpers from 0002_rls_policies.sql and adds
-- one new helper below.

alter table commitments enable row level security;
alter table commitment_payments enable row level security;

-- New helper: mirrors hasWriteAccess() in src/logic/permissions.ts — an
-- active admin, or an active member whose access_level isn't 'view_only'.
-- (is_pot_member alone isn't enough here because a view-only member must be
-- able to SELECT but never INSERT/UPDATE.)
create or replace function is_pot_write_member(target_pot_id uuid)
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
      and (role = 'admin' or access_level = 'member')
  );
$$;

-- The pot_member row for the current auth user in a given Pot, used to check
-- "did I create this Commitment" ownership below.
create or replace function current_pot_member_id(target_pot_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select id from pot_members
  where pot_id = target_pot_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- commitments: visible to any member of the same Pot (isolation, spec
-- section 26 — a Commitment from one Pot must never appear in another).
create policy commitments_select_same_pot on commitments
  for select
  using (is_pot_member(pot_id));

-- Create follows the same rule as adding an expense (canCreateCommitment ==
-- canAddExpense): admin or a non-view-only active member.
create policy commitments_insert_write_member on commitments
  for insert
  with check (is_pot_write_member(pot_id));

-- Admin may edit any Commitment; a regular member only one they created;
-- view-only never (mirrors canEditCommitment in src/logic/permissions.ts).
create policy commitments_update_admin_or_own on commitments
  for update
  using (
    is_pot_admin(pot_id)
    or (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id))
  );

-- commitment_payments: visible to any member of the same Pot.
create policy commitment_payments_select_same_pot on commitment_payments
  for select
  using (is_pot_member(pot_id));

-- Payments are only ever written by the RPCs in 0007 (which re-validate
-- amount/permission/cancelled-state server-side), but this policy is the
-- floor even if a client ever inserts directly.
create policy commitment_payments_insert_write_member on commitment_payments
  for insert
  with check (is_pot_write_member(pot_id));

-- Deleting a commitment_payment only ever happens as the cascade side-effect
-- of deleting its linked transaction (spec section 27) — same permission
-- floor as insert.
create policy commitment_payments_delete_write_member on commitment_payments
  for delete
  using (is_pot_write_member(pot_id));
