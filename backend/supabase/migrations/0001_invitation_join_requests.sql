-- Potto Invitation & Join Request feature — schema.
--
-- NOT CONNECTED to a live Supabase project. This is a reference implementation
-- delivered alongside a client-only local implementation (see src/logic/join-requests.ts
-- and src/store/PottoStore.tsx) so a future move to a real backend is a drop-in.
-- Column/table names follow src/mvp/Potto_Invitation_Join_Request_Spec.md exactly.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text unique,
  avatar text,
  created_at timestamptz not null default now()
);

create table if not exists pots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references users(id),
  -- Random, non-sequential, unguessable. Identifies the Pot only — never a person,
  -- role, or permission (spec section 2).
  invite_code text not null unique,
  invite_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists pot_members (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references pots(id) on delete cascade,
  -- Nullable: a financial identity can exist before the person has a Potto account.
  user_id uuid references users(id),
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  access_level text not null default 'member' check (access_level in ('member', 'view_only')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- A pot_member can never be linked to more than one Potto account, and one
-- account can never hold two active financial identities in the same Pot.
create unique index if not exists pot_members_pot_user_unique
  on pot_members (pot_id, user_id)
  where user_id is not null;

create index if not exists pot_members_pot_id_idx on pot_members (pot_id);

create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references pots(id) on delete cascade,
  user_id uuid not null references users(id),
  requested_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  linked_member_id uuid references pot_members(id),
  reviewed_by uuid references pot_members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Prevents duplicate active/pending requests for the same user + Pot
-- (spec section 6 / "Duplicate Handling").
create unique index if not exists join_requests_pending_unique
  on join_requests (pot_id, user_id)
  where status = 'pending';

create index if not exists join_requests_pot_id_idx on join_requests (pot_id);
create index if not exists join_requests_user_id_idx on join_requests (user_id);

-- Financial tables (contributions/expenses/settlements) already exist in the
-- product and are intentionally not redefined here. They must keep
-- referencing pot_member_id — never user_id — per spec section 3/19.
