-- Complete Potto schema for shared mobile + web backend.
-- Applied to empty Supabase project. Supersedes conceptual notes in 0001–0007
-- by wiring auth.users, adding the transactions ledger, and full RLS.

-- ---------------------------------------------------------------------------
-- Profiles (auth-linked)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique,
  phone text unique,
  avatar text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Pots
-- ---------------------------------------------------------------------------
create table public.pots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'INR',
  created_by uuid not null references public.users(id),
  invite_code text not null unique,
  invite_enabled boolean not null default true,
  join_code text not null unique,
  join_enabled boolean not null default true,
  expected_contribution_per_member bigint check (
    expected_contribution_per_member is null or expected_contribution_per_member > 0
  ),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index pots_created_by_idx on public.pots (created_by);
create index pots_invite_code_idx on public.pots (invite_code);
create index pots_join_code_idx on public.pots (join_code);

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
create table public.pot_members (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  user_id uuid references public.users(id),
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  access_level text not null default 'member' check (access_level in ('member', 'view_only')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create unique index pot_members_pot_user_unique
  on public.pot_members (pot_id, user_id)
  where user_id is not null;

create index pot_members_pot_id_idx on public.pot_members (pot_id);
create index pot_members_user_id_idx on public.pot_members (user_id);

-- ---------------------------------------------------------------------------
-- Join requests
-- ---------------------------------------------------------------------------
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  user_id uuid not null references public.users(id),
  requested_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  linked_member_id uuid references public.pot_members(id),
  reviewed_by uuid references public.pot_members(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index join_requests_pending_unique
  on public.join_requests (pot_id, user_id)
  where status = 'pending';

create index join_requests_pot_id_idx on public.join_requests (pot_id);
create index join_requests_user_id_idx on public.join_requests (user_id);

-- ---------------------------------------------------------------------------
-- Transactions ledger
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  type text not null check (type in ('contribution', 'pool_expense', 'member_expense', 'settlement')),
  description text not null,
  amount bigint not null check (amount > 0),
  date date not null,
  note text,
  category text,
  paid_by uuid references public.pot_members(id),
  to_member uuid references public.pot_members(id),
  payment_method text check (payment_method is null or payment_method in ('cash', 'upi', 'bank_transfer', 'other')),
  payment_source text check (payment_source is null or payment_source in ('pool', 'personal')),
  split_method text check (split_method is null or split_method in ('equal', 'custom', 'percentage')),
  participants uuid[] default '{}',
  created_by uuid not null references public.pot_members(id),
  created_at timestamptz not null default now()
);

create index transactions_pot_id_idx on public.transactions (pot_id);
create index transactions_pot_date_idx on public.transactions (pot_id, date desc, created_at desc);

create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  member_id uuid not null references public.pot_members(id),
  amount bigint not null check (amount >= 0),
  unique (transaction_id, member_id)
);

create index transaction_splits_tx_idx on public.transaction_splits (transaction_id);

-- ---------------------------------------------------------------------------
-- Commitments
-- ---------------------------------------------------------------------------
create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  title text not null,
  vendor_name text,
  category text,
  description text,
  total_amount bigint not null check (total_amount > 0),
  due_date date,
  status text not null default 'planned'
    check (status in ('planned', 'partially_paid', 'fully_paid', 'cancelled')),
  created_by uuid not null references public.pot_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index commitments_pot_id_idx on public.commitments (pot_id);

create table public.commitment_payments (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  pot_id uuid not null references public.pots(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id)
);

create index commitment_payments_commitment_id_idx on public.commitment_payments (commitment_id);
create index commitment_payments_pot_id_idx on public.commitment_payments (pot_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_pot_member(target_pot_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pot_members
    where pot_id = target_pot_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_pot_admin(target_pot_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pot_members
    where pot_id = target_pot_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'admin'
  );
$$;

create or replace function public.is_pot_write_member(target_pot_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pot_members
    where pot_id = target_pot_id
      and user_id = auth.uid()
      and status = 'active'
      and (role = 'admin' or access_level = 'member')
  );
$$;

create or replace function public.current_pot_member_id(target_pot_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.pot_members
  where pot_id = target_pot_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- Invite/join resolution: return safe pot summary without requiring membership
create or replace function public.resolve_invite_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  status text,
  invite_enabled boolean,
  member_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_code text := lower(trim(p_code));
begin
  return query
  select
    p.id,
    p.name,
    p.description,
    p.status,
    p.invite_enabled,
    (select count(*) from public.pot_members m where m.pot_id = p.id and m.status = 'active')
  from public.pots p
  where lower(p.invite_code) = v_code;
end;
$$;

create or replace function public.resolve_join_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  status text,
  join_enabled boolean,
  member_count bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
begin
  return query
  select
    p.id,
    p.name,
    p.description,
    p.status,
    p.join_enabled,
    (select count(*) from public.pot_members m where m.pot_id = p.id and m.status = 'active')
  from public.pots p
  where upper(p.join_code) = v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.pots enable row level security;
alter table public.pot_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_payments enable row level security;

-- users
create policy users_select_authenticated on public.users
  for select to authenticated using (true);
create policy users_update_own on public.users
  for update to authenticated using (id = auth.uid());

-- pots
create policy pots_select_member on public.pots
  for select to authenticated
  using (is_pot_member(id) or created_by = auth.uid());
create policy pots_insert_authenticated on public.pots
  for insert to authenticated
  with check (created_by = auth.uid());
create policy pots_update_admin on public.pots
  for update to authenticated
  using (is_pot_admin(id));
create policy pots_delete_admin on public.pots
  for delete to authenticated
  using (is_pot_admin(id));

-- pot_members
create policy pot_members_select on public.pot_members
  for select to authenticated
  using (is_pot_member(pot_id) or user_id = auth.uid());
create policy pot_members_insert on public.pot_members
  for insert to authenticated
  with check (
    is_pot_admin(pot_id)
    or (
      -- creator bootstrapping self as admin when creating a pot
      user_id = auth.uid()
      and role = 'admin'
      and exists (select 1 from public.pots p where p.id = pot_id and p.created_by = auth.uid())
    )
  );
create policy pot_members_update_admin on public.pot_members
  for update to authenticated
  using (is_pot_admin(pot_id));

-- join_requests
create policy join_requests_select on public.join_requests
  for select to authenticated
  using (user_id = auth.uid() or is_pot_admin(pot_id));
create policy join_requests_insert on public.join_requests
  for insert to authenticated
  with check (user_id = auth.uid());
create policy join_requests_update on public.join_requests
  for update to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or is_pot_admin(pot_id)
  );

-- transactions
create policy transactions_select on public.transactions
  for select to authenticated
  using (is_pot_member(pot_id));
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id));
create policy transactions_update on public.transactions
  for update to authenticated
  using (
    is_pot_admin(pot_id)
    or (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id))
  );
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
    is_pot_admin(pot_id)
    or (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id))
  );

-- splits
create policy transaction_splits_select on public.transaction_splits
  for select to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and is_pot_member(t.pot_id)
    )
  );
create policy transaction_splits_insert on public.transaction_splits
  for insert to authenticated
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and is_pot_write_member(t.pot_id)
    )
  );
create policy transaction_splits_delete on public.transaction_splits
  for delete to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and is_pot_write_member(t.pot_id)
    )
  );

-- commitments
create policy commitments_select on public.commitments
  for select to authenticated using (is_pot_member(pot_id));
create policy commitments_insert on public.commitments
  for insert to authenticated with check (is_pot_write_member(pot_id));
create policy commitments_update on public.commitments
  for update to authenticated
  using (
    is_pot_admin(pot_id)
    or (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id))
  );

-- commitment_payments
create policy commitment_payments_select on public.commitment_payments
  for select to authenticated using (is_pot_member(pot_id));
create policy commitment_payments_insert on public.commitment_payments
  for insert to authenticated with check (is_pot_write_member(pot_id));
create policy commitment_payments_delete on public.commitment_payments
  for delete to authenticated using (is_pot_write_member(pot_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.resolve_invite_code(text) to authenticated, anon;
grant execute on function public.resolve_join_code(text) to authenticated, anon;
