-- Pool management: Pool Manager (separate from pot admin), Pool Bank / Pool Cash,
-- and pool transfers on the existing transactions ledger.
-- Amounts stay integer paise. Balances are derived, never stored.

-- ---------------------------------------------------------------------------
-- Pool accounts (logical locations of pot money — not personal bank accounts)
-- ---------------------------------------------------------------------------
create table public.pool_accounts (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bank', 'cash')),
  currency text not null default 'INR',
  active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pool_accounts_pot_id_idx on public.pool_accounts (pot_id);
create unique index pool_accounts_one_default_per_type
  on public.pool_accounts (pot_id, type)
  where is_default and active;

-- ---------------------------------------------------------------------------
-- Pool manager assignment. Multiple rows allowed over time; exactly one active.
-- Deactivating a row never rewrites historical transactions.
-- ---------------------------------------------------------------------------
create table public.pot_pool_managers (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  pot_member_id uuid not null references public.pot_members(id),
  assigned_by uuid references public.pot_members(id),
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (pot_id, pot_member_id, assigned_at)
);

create index pot_pool_managers_pot_id_idx on public.pot_pool_managers (pot_id);
create index pot_pool_managers_member_idx on public.pot_pool_managers (pot_member_id);
create unique index pot_pool_managers_one_active
  on public.pot_pool_managers (pot_id)
  where active;

-- ---------------------------------------------------------------------------
-- Extend the ledger
-- ---------------------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('contribution', 'pool_expense', 'member_expense', 'settlement', 'pool_transfer'));

alter table public.transactions
  add column pool_account_id uuid references public.pool_accounts(id),
  add column to_pool_account_id uuid references public.pool_accounts(id),
  add column received_via text,
  add column updated_at timestamptz not null default now();

alter table public.transactions
  add constraint transactions_received_via_check
  check (received_via is null or received_via in ('online', 'cash'));

create index transactions_pool_account_idx on public.transactions (pool_account_id);
create index transactions_to_pool_account_idx on public.transactions (to_pool_account_id);
create index transactions_type_idx on public.transactions (pot_id, type);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_pool_accounts(p_pot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text;
begin
  select currency into v_currency from public.pots where id = p_pot_id;
  if v_currency is null then
    raise exception 'pot not found';
  end if;

  insert into public.pool_accounts (pot_id, name, type, currency, active, is_default)
  select p_pot_id, 'Pool Bank', 'bank', v_currency, true, true
  where not exists (
    select 1 from public.pool_accounts
    where pot_id = p_pot_id and type = 'bank' and is_default and active
  );

  insert into public.pool_accounts (pot_id, name, type, currency, active, is_default)
  select p_pot_id, 'Pool Cash', 'cash', v_currency, true, true
  where not exists (
    select 1 from public.pool_accounts
    where pot_id = p_pot_id and type = 'cash' and is_default and active
  );
end;
$$;

create or replace function public.is_pool_manager(target_pot_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.pot_pool_managers pm
    join public.pot_members m on m.id = pm.pot_member_id
    where pm.pot_id = target_pot_id
      and pm.active
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.pool_account_signed_effect(
  p_type text,
  p_amount bigint,
  p_account_id uuid,
  p_pool_account_id uuid,
  p_to_pool_account_id uuid
)
returns bigint
language sql
immutable
as $$
  select case
    when p_type = 'contribution' and p_pool_account_id = p_account_id then p_amount
    when p_type = 'pool_transfer' and p_to_pool_account_id = p_account_id then p_amount
    when p_type = 'pool_expense' and p_pool_account_id = p_account_id then -p_amount
    when p_type = 'pool_transfer' and p_pool_account_id = p_account_id then -p_amount
    else 0
  end;
$$;

create or replace function public.pool_account_balance(p_account_id uuid, p_exclude_tx uuid default null)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    public.pool_account_signed_effect(t.type, t.amount, p_account_id, t.pool_account_id, t.to_pool_account_id)
  ), 0)
  from public.transactions t
  where (t.pool_account_id = p_account_id or t.to_pool_account_id = p_account_id)
    and (p_exclude_tx is null or t.id <> p_exclude_tx);
$$;

-- ---------------------------------------------------------------------------
-- Integrity: same pot, valid shape, transfers cannot exceed source balance.
-- Pool transfers do not change total pool balance because both legs live on one row.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_pool_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.pool_accounts;
  v_to public.pool_accounts;
  v_member public.pot_members;
  v_balance bigint;
begin
  new.updated_at := now();

  if new.paid_by is not null then
    select * into v_member from public.pot_members where id = new.paid_by;
    if v_member is null or v_member.pot_id <> new.pot_id then
      raise exception 'selected member does not belong to this pot';
    end if;
  end if;

  if new.to_member is not null then
    select * into v_member from public.pot_members where id = new.to_member;
    if v_member is null or v_member.pot_id <> new.pot_id then
      raise exception 'selected member does not belong to this pot';
    end if;
  end if;

  if new.pool_account_id is not null then
    select * into v_from from public.pool_accounts where id = new.pool_account_id;
    if v_from is null or v_from.pot_id <> new.pot_id then
      raise exception 'pool account does not belong to this pot';
    end if;
  end if;

  if new.to_pool_account_id is not null then
    select * into v_to from public.pool_accounts where id = new.to_pool_account_id;
    if v_to is null or v_to.pot_id <> new.pot_id then
      raise exception 'pool account does not belong to this pot';
    end if;
  end if;

  if new.type = 'contribution' then
    if new.pool_account_id is null or new.received_via is null or new.paid_by is null then
      raise exception 'a contribution needs a member, received as, and pool account';
    end if;
    if new.to_pool_account_id is not null then
      raise exception 'a contribution has one pool account';
    end if;
    if tg_op = 'INSERT' and not v_from.active then
      raise exception 'that pool account is not active';
    end if;
  elsif new.type = 'pool_expense' then
    if new.pool_account_id is null then
      raise exception 'a pool expense must be paid from a pool account';
    end if;
    if new.to_pool_account_id is not null then
      raise exception 'a pool expense has one pool account';
    end if;
    new.payment_source := 'pool';
    if tg_op = 'INSERT' and not v_from.active then
      raise exception 'that pool account is not active';
    end if;
  elsif new.type = 'member_expense' then
    if new.pool_account_id is not null or new.to_pool_account_id is not null then
      raise exception 'a personal expense does not use pool money';
    end if;
    new.payment_source := 'personal';
    new.received_via := null;
  elsif new.type = 'pool_transfer' then
    if new.pool_account_id is null or new.to_pool_account_id is null then
      raise exception 'a transfer needs a source and a destination';
    end if;
    if new.pool_account_id = new.to_pool_account_id then
      raise exception 'choose two different pool accounts';
    end if;
    if new.amount <= 0 then
      raise exception 'amount must be greater than zero';
    end if;
    if not (public.is_pot_admin(new.pot_id) or public.is_pool_manager(new.pot_id)) then
      raise exception 'only the pool manager or a pot admin can transfer pool money';
    end if;
    if tg_op = 'INSERT' and (not v_from.active or not v_to.active) then
      raise exception 'that pool account is not active';
    end if;
    v_balance := public.pool_account_balance(new.pool_account_id, case when tg_op = 'UPDATE' then old.id else null end);
    if v_balance < new.amount then
      raise exception 'not enough money in that pool account';
    end if;
    new.paid_by := null;
    new.payment_source := null;
    new.received_via := null;
  elsif new.type = 'settlement' then
    if new.pool_account_id is not null or new.to_pool_account_id is not null then
      raise exception 'a settlement does not move pool accounts';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_enforce_pool
  before insert or update on public.transactions
  for each row execute function public.enforce_pool_transaction();

-- Clear the active pool manager when that member leaves. History stays.
create or replace function public.clear_pool_manager_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'inactive' and old.status = 'active' then
    update public.pot_pool_managers
    set active = false
    where pot_member_id = new.id and active;
  end if;
  return new;
end;
$$;

create trigger pot_members_clear_pool_manager
  after update of status on public.pot_members
  for each row execute function public.clear_pool_manager_on_leave();

-- ---------------------------------------------------------------------------
-- Backfill existing pots
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_bank uuid;
  v_cash uuid;
  v_owner uuid;
begin
  for r in select id from public.pots loop
    perform public.ensure_default_pool_accounts(r.id);
    select id into v_bank from public.pool_accounts
      where pot_id = r.id and type = 'bank' and is_default and active limit 1;
    select id into v_cash from public.pool_accounts
      where pot_id = r.id and type = 'cash' and is_default and active limit 1;

    update public.transactions
    set pool_account_id = case when payment_method = 'cash' then v_cash else v_bank end,
        received_via = case when payment_method = 'cash' then 'cash' else 'online' end
    where pot_id = r.id and type = 'contribution' and pool_account_id is null and paid_by is not null;

    update public.transactions
    set pool_account_id = v_bank
    where pot_id = r.id and type = 'pool_expense' and pool_account_id is null;

    select id into v_owner from public.pot_members
      where pot_id = r.id and status = 'active' and role = 'owner'
      order by created_at asc limit 1;
    if v_owner is null then
      select id into v_owner from public.pot_members
        where pot_id = r.id and status = 'active' and role in ('owner', 'admin')
        order by created_at asc limit 1;
    end if;
    if v_owner is not null and not exists (
      select 1 from public.pot_pool_managers where pot_id = r.id and active
    ) then
      insert into public.pot_pool_managers (pot_id, pot_member_id, assigned_by, active)
      values (r.id, v_owner, v_owner, true);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_pot also opens Pool Bank, Pool Cash, and assigns the owner as manager
-- ---------------------------------------------------------------------------
create or replace function public.create_pot(
  p_name text,
  p_description text default null,
  p_member_names text[] default '{}',
  p_starting_contribution bigint default null,
  p_expected_contribution_per_member bigint default null,
  p_invite_code text default null,
  p_join_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_pot_id uuid;
  v_owner_id uuid;
  v_invite text;
  v_join text;
  v_name text;
  v_bank uuid;
  alphabet_invite text := '23456789abcdefghjkmnpqrstuvwxyz';
  alphabet_join text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  i int;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;

  select * into v_user from public.users where id = auth.uid();
  if v_user is null then
    raise exception 'profile not found';
  end if;

  v_invite := coalesce(p_invite_code, '');
  if length(v_invite) = 0 then
    loop
      v_invite := '';
      for i in 1..8 loop
        v_invite := v_invite || substr(alphabet_invite, 1 + floor(random() * length(alphabet_invite))::int, 1);
      end loop;
      exit when not exists (select 1 from public.pots where invite_code = v_invite);
    end loop;
  end if;

  v_join := coalesce(p_join_code, '');
  if length(v_join) = 0 then
    loop
      v_join := '';
      for i in 1..6 loop
        v_join := v_join || substr(alphabet_join, 1 + floor(random() * length(alphabet_join))::int, 1);
      end loop;
      exit when not exists (select 1 from public.pots where join_code = v_join);
    end loop;
  end if;

  insert into public.pots (
    name, description, created_by, invite_code, join_code, expected_contribution_per_member
  ) values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid(),
    v_invite,
    v_join,
    case when p_expected_contribution_per_member is not null and p_expected_contribution_per_member > 0
      then p_expected_contribution_per_member else null end
  )
  returning id into v_pot_id;

  insert into public.pot_members (pot_id, user_id, display_name, role, access_level, status)
  values (v_pot_id, auth.uid(), v_user.name, 'owner', 'member', 'active')
  returning id into v_owner_id;

  perform public.ensure_default_pool_accounts(v_pot_id);

  insert into public.pot_pool_managers (pot_id, pot_member_id, assigned_by, active)
  values (v_pot_id, v_owner_id, v_owner_id, true);

  if p_member_names is not null then
    foreach v_name in array p_member_names loop
      if length(trim(v_name)) > 0 then
        insert into public.pot_members (pot_id, user_id, display_name, role, access_level, status)
        values (v_pot_id, null, trim(v_name), 'member', 'member', 'active');
      end if;
    end loop;
  end if;

  if p_starting_contribution is not null and p_starting_contribution > 0 then
    select id into v_bank from public.pool_accounts
      where pot_id = v_pot_id and type = 'bank' and is_default and active limit 1;
    insert into public.transactions (
      pot_id, type, description, amount, date, paid_by, created_by, note,
      pool_account_id, received_via
    ) values (
      v_pot_id, 'contribution', 'Trip contribution', p_starting_contribution,
      current_date, v_owner_id, v_owner_id, 'Initial contribution',
      v_bank, 'online'
    );
  end if;

  return v_pot_id;
end;
$$;

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

  if not public.is_pot_owner(p_pot_id) then
    raise exception 'Only the pot owner can delete this pot';
  end if;

  delete from public.commitment_payments where pot_id = p_pot_id;
  delete from public.commitments where pot_id = p_pot_id;

  delete from public.transaction_splits
  where transaction_id in (select id from public.transactions where pot_id = p_pot_id);

  delete from public.transactions where pot_id = p_pot_id;
  delete from public.pot_pool_managers where pot_id = p_pot_id;
  delete from public.pool_accounts where pot_id = p_pot_id;

  update public.join_requests
  set linked_member_id = null, reviewed_by = null
  where pot_id = p_pot_id;

  delete from public.join_requests where pot_id = p_pot_id;
  delete from public.pot_members where pot_id = p_pot_id;
  delete from public.pots where id = p_pot_id;
end;
$$;

create or replace function public.assign_pool_manager(p_pot_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.pot_members;
  v_id uuid;
begin
  if not public.is_pot_admin(p_pot_id) then
    raise exception 'only a pot admin can change the pool manager';
  end if;

  select * into v_member from public.pot_members where id = p_member_id;
  if v_member is null or v_member.pot_id <> p_pot_id or v_member.status <> 'active' then
    raise exception 'choose an active member of this pot';
  end if;

  update public.pot_pool_managers
  set active = false
  where pot_id = p_pot_id and active and pot_member_id <> p_member_id;

  if exists (
    select 1 from public.pot_pool_managers
    where pot_id = p_pot_id and pot_member_id = p_member_id and active
  ) then
    select id into v_id from public.pot_pool_managers
    where pot_id = p_pot_id and pot_member_id = p_member_id and active
    limit 1;
    return v_id;
  end if;

  insert into public.pot_pool_managers (pot_id, pot_member_id, assigned_by, active)
  values (p_pot_id, p_member_id, public.current_pot_member_id(p_pot_id), true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_pool_transfer(
  p_pot_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount bigint,
  p_date date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_pot_member(p_pot_id) then
    raise exception 'not a member of this pot';
  end if;
  if not (public.is_pot_admin(p_pot_id) or public.is_pool_manager(p_pot_id)) then
    raise exception 'only the pool manager or a pot admin can transfer pool money';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than zero';
  end if;

  v_member_id := public.current_pot_member_id(p_pot_id);
  if v_member_id is null then
    raise exception 'not a member of this pot';
  end if;

  insert into public.transactions (
    pot_id, type, description, amount, date, note, created_by,
    pool_account_id, to_pool_account_id
  ) values (
    p_pot_id, 'pool_transfer', 'Transfer', p_amount, p_date, nullif(trim(coalesce(p_note, '')), ''),
    v_member_id, p_from_account_id, p_to_account_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pool_accounts enable row level security;
alter table public.pot_pool_managers enable row level security;

create policy pool_accounts_select on public.pool_accounts
  for select to authenticated
  using (is_pot_member(pot_id));

create policy pot_pool_managers_select on public.pot_pool_managers
  for select to authenticated
  using (is_pot_member(pot_id));

-- Financial writes: existing writers, plus the pool manager (even if view-only).
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (
    created_by = current_pot_member_id(pot_id)
    and (is_pot_write_member(pot_id) or is_pool_manager(pot_id))
  );

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (
    is_pot_admin(pot_id)
    or is_pool_manager(pot_id)
    or (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id))
  );

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
    is_pot_admin(pot_id)
    or is_pool_manager(pot_id)
    or (is_pot_write_member(pot_id) and created_by = current_pot_member_id(pot_id))
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions',
    'transaction_splits',
    'pool_accounts',
    'pot_pool_managers',
    'pot_members',
    'commitments',
    'commitment_payments'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.transaction_type_label(p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_type
    when 'contribution' then 'added money'
    when 'pool_expense' then 'added an expense'
    when 'member_expense' then 'added an expense'
    when 'settlement' then 'recorded a settlement'
    when 'pool_transfer' then 'transferred pool money'
    else 'updated the pot'
  end;
$$;

revoke all on function public.ensure_default_pool_accounts(uuid) from public;
revoke all on function public.is_pool_manager(uuid) from public;
revoke all on function public.pool_account_balance(uuid, uuid) from public;
revoke all on function public.enforce_pool_transaction() from public;
revoke all on function public.clear_pool_manager_on_leave() from public;
revoke all on function public.assign_pool_manager(uuid, uuid) from public;
revoke all on function public.create_pool_transfer(uuid, uuid, uuid, bigint, date, text) from public;

grant execute on function public.is_pool_manager(uuid) to authenticated;
grant execute on function public.pool_account_balance(uuid, uuid) to authenticated;
grant execute on function public.assign_pool_manager(uuid, uuid) to authenticated;
grant execute on function public.create_pool_transfer(uuid, uuid, uuid, bigint, date, text) to authenticated;
