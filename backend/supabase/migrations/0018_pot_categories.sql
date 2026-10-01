-- Pot-specific, customizable expense categories.
--
-- Before: `transactions.category` and `commitments.category` were free-form text
-- chosen from a hardcoded suggestion list in each client.
-- After:  each Pot owns its own rows in `pot_categories`; expenses and upcoming
-- payments reference one by `category_id`. Renaming a category therefore
-- re-labels history automatically, and a category is archived (is_active =
-- false), never deleted, once anything uses it.
--
-- Categories are classification only. Nothing in this migration touches an
-- amount, payer, participant, split, pool balance or settlement.

-- ---------------------------------------------------------------------------
-- Product constant: the most active categories a Pot may have.
-- Mirrored by MAX_ACTIVE_CATEGORIES in the web and mobile category logic.
-- ---------------------------------------------------------------------------
create or replace function public.max_active_pot_categories()
returns int
language sql
immutable
set search_path = public
as $$ select 30 $$;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.pot_categories (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.pots(id) on delete cascade,
  name text not null,
  -- Lucide icon identifier from a controlled catalog. Never SVG.
  icon text not null default 'tag',
  -- Palette key from a controlled catalog. Never a user-entered hex value.
  color text not null default 'gray',
  is_active boolean not null default true,
  -- True for rows created from the default set when the Pot was created.
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pot_categories_name_check
    check (char_length(btrim(name)) between 1 and 40),
  constraint pot_categories_icon_check
    check (icon in (
      'utensils', 'car', 'bed', 'sparkles', 'shopping-bag', 'fuel', 'ticket',
      'landmark', 'heart', 'music', 'camera', 'gift', 'coffee', 'plane', 'map',
      'more-horizontal', 'shopping-cart', 'wine', 'tag'
    )),
  constraint pot_categories_color_check
    check (color in ('green', 'gold', 'blue', 'purple', 'orange', 'red', 'teal', 'gray')),
  -- Lets other tables prove "this category belongs to the SAME pot" with a
  -- composite foreign key instead of trusting application code.
  constraint pot_categories_id_pot_unique unique (id, pot_id)
);

-- Case-insensitive duplicate prevention, per pot. Archived rows count too, so a
-- name can always be restored and history never has two categories that read
-- the same.
create unique index pot_categories_pot_name_unique
  on public.pot_categories (pot_id, lower(btrim(name)));

create index pot_categories_pot_order_idx
  on public.pot_categories (pot_id, sort_order, created_at);

create or replace function public.pot_categories_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.pot_id <> old.pot_id then
    raise exception 'a category cannot be moved to another pot';
  end if;
  return new;
end;
$$;

create trigger pot_categories_guard
  before insert or update on public.pot_categories
  for each row execute function public.pot_categories_guard();

-- ---------------------------------------------------------------------------
-- Default category set
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_pot_categories(p_pot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pot_categories (pot_id, name, icon, color, is_default, sort_order)
  select p_pot_id, d.name, d.icon, d.color, true, d.ord
  from (values
    ('Food',          'utensils',        'orange', 1),
    ('Transport',     'car',             'blue',   2),
    ('Accommodation', 'bed',             'purple', 3),
    ('Activities',    'sparkles',        'teal',   4),
    ('Shopping',      'shopping-bag',    'gold',   5),
    ('Fuel',          'fuel',            'red',    6),
    ('Tickets',       'ticket',          'green',  7),
    ('Other',         'more-horizontal', 'gray',   8)
  ) as d(name, icon, color, ord)
  on conflict do nothing;
end;
$$;

create or replace function public.pots_seed_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_pot_categories(new.id);
  return new;
end;
$$;

create trigger pots_seed_categories
  after insert on public.pots
  for each row execute function public.pots_seed_categories();

-- ---------------------------------------------------------------------------
-- References from the ledger
-- ---------------------------------------------------------------------------
alter table public.transactions add column category_id uuid;
alter table public.commitments add column category_id uuid;

comment on column public.transactions.category is
  'DEPRECATED legacy free text, kept only for rollback. Use category_id.';
comment on column public.commitments.category is
  'DEPRECATED legacy free text, kept only for rollback. Use category_id.';

-- ---------------------------------------------------------------------------
-- Backfill existing data
-- ---------------------------------------------------------------------------
-- Every existing pot gets the default set.
select public.seed_default_pot_categories(id) from public.pots;

-- Normalises legacy text to a lookup key: trimmed, single-spaced, lowercase,
-- clipped to the category name limit, and with the old built-in names that were
-- renamed in the default set mapped onto their replacements.
create function public._legacy_category_key(p_text text)
returns text
language sql
immutable
as $$
  select case k
    when 'stay' then 'accommodation'
    when 'miscellaneous' then 'other'
    when 'misc' then 'other'
    when 'others' then 'other'
    when 'activity' then 'activities'
    when 'ticket' then 'tickets'
    else k
  end
  from (
    select lower(btrim(left(btrim(regexp_replace(p_text, '\s+', ' ', 'g')), 40))) as k
  ) s
  where k <> ''
$$;

-- Anything a pot actually used that is not in its defaults (Groceries, Drinks,
-- or free text typed on an old client) becomes a custom category in that pot,
-- so no label is lost.
insert into public.pot_categories (pot_id, name, icon, color, is_default, sort_order)
select
  u.pot_id,
  u.name,
  case u.key when 'groceries' then 'shopping-cart' when 'drinks' then 'wine' else 'tag' end,
  'gray',
  false,
  100 + row_number() over (partition by u.pot_id order by u.key)
from (
  select distinct on (pot_id, key)
    pot_id,
    key,
    case
      when btrim(left(btrim(regexp_replace(category, '\s+', ' ', 'g')), 40))
           = lower(btrim(left(btrim(regexp_replace(category, '\s+', ' ', 'g')), 40)))
        then initcap(btrim(left(btrim(regexp_replace(category, '\s+', ' ', 'g')), 40)))
      else btrim(left(btrim(regexp_replace(category, '\s+', ' ', 'g')), 40))
    end as name
  from (
    select pot_id, category, public._legacy_category_key(category) as key
    from public.transactions
    where type in ('pool_expense', 'member_expense') and category is not null
    union all
    select pot_id, category, public._legacy_category_key(category) as key
    from public.commitments
    where category is not null
  ) legacy
  where key is not null
  order by pot_id, key, category
) u
where not exists (
  select 1 from public.pot_categories c
  where c.pot_id = u.pot_id and lower(btrim(c.name)) = u.key
);

-- Tidy the sort order of the custom rows just added (defaults stay 1..8).
update public.pot_categories c
set sort_order = r.rn
from (
  select id, row_number() over (partition by pot_id order by sort_order, created_at, name) as rn
  from public.pot_categories
) r
where c.id = r.id and c.sort_order <> r.rn;

-- The ledger triggers do unrelated work (balance checks, updated_at); this is a
-- pure relabel, so keep them out of the way for the one-off backfill.
alter table public.transactions disable trigger transactions_enforce_pool;

update public.transactions t
set category_id = c.id
from public.pot_categories c
where c.pot_id = t.pot_id
  and lower(btrim(c.name)) = public._legacy_category_key(t.category)
  and t.type in ('pool_expense', 'member_expense')
  and t.category is not null;

alter table public.transactions enable trigger transactions_enforce_pool;

update public.commitments m
set category_id = c.id
from public.pot_categories c
where c.pot_id = m.pot_id
  and lower(btrim(c.name)) = public._legacy_category_key(m.category)
  and m.category is not null;

drop function public._legacy_category_key(text);

-- ---------------------------------------------------------------------------
-- Integrity: the category must belong to the SAME pot as the row using it.
-- Composite FKs (MATCH SIMPLE) are skipped while category_id is null, which is
-- how "Uncategorized" is represented. With the default NO ACTION they also make
-- it impossible to hard-delete a category that anything still references.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add constraint transactions_category_same_pot_fk
  foreign key (category_id, pot_id) references public.pot_categories (id, pot_id);

alter table public.commitments
  add constraint commitments_category_same_pot_fk
  foreign key (category_id, pot_id) references public.pot_categories (id, pot_id);

create index transactions_category_idx on public.transactions (category_id);
create index commitments_category_idx on public.commitments (category_id);

-- Only expenses carry a category, and a NEW selection must be an active one.
-- Keeping an already-assigned archived category (edit without changing it) is
-- always allowed so history stays editable.
create or replace function public.enforce_transaction_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  if new.category_id is null then
    return new;
  end if;

  if new.type not in ('pool_expense', 'member_expense') then
    raise exception 'only expenses can have a category';
  end if;

  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id then
    select is_active into v_active
    from public.pot_categories
    where id = new.category_id and pot_id = new.pot_id;
    if v_active is null then
      raise exception 'category does not belong to this pot';
    end if;
    if not v_active then
      raise exception 'that category is archived';
    end if;
  end if;

  return new;
end;
$$;

create trigger transactions_enforce_category
  before insert or update on public.transactions
  for each row execute function public.enforce_transaction_category();

create or replace function public.enforce_commitment_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active boolean;
begin
  if new.category_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id then
    select is_active into v_active
    from public.pot_categories
    where id = new.category_id and pot_id = new.pot_id;
    if v_active is null then
      raise exception 'category does not belong to this pot';
    end if;
    if not v_active then
      raise exception 'that category is archived';
    end if;
  end if;

  return new;
end;
$$;

create trigger commitments_enforce_category
  before insert or update on public.commitments
  for each row execute function public.enforce_commitment_category();

-- ---------------------------------------------------------------------------
-- RLS: members read; nobody writes the table directly. All writes go through
-- the RPCs below, which derive authorization from the category's own pot.
-- ---------------------------------------------------------------------------
alter table public.pot_categories enable row level security;

create policy pot_categories_select on public.pot_categories
  for select to authenticated
  using (is_pot_member(pot_id));

-- ---------------------------------------------------------------------------
-- Management RPCs (pot admin / owner only)
-- ---------------------------------------------------------------------------
create or replace function public.create_pot_category(
  p_pot_id uuid,
  p_name text,
  p_icon text default 'tag',
  p_color text default 'gray'
)
returns public.pot_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_row public.pot_categories;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_pot_admin(p_pot_id) then
    raise exception 'only a pot admin can manage categories';
  end if;
  if v_name = '' then
    raise exception 'enter a category name';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'category names can be at most 40 characters';
  end if;

  perform 1 from public.pots where id = p_pot_id for update;

  if (select count(*) from public.pot_categories where pot_id = p_pot_id and is_active)
     >= public.max_active_pot_categories() then
    raise exception 'a pot can have at most % active categories', public.max_active_pot_categories();
  end if;

  begin
    insert into public.pot_categories (pot_id, name, icon, color, sort_order)
    values (
      p_pot_id, v_name, coalesce(p_icon, 'tag'), coalesce(p_color, 'gray'),
      coalesce((select max(sort_order) from public.pot_categories where pot_id = p_pot_id), 0) + 1
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'this pot already has a category named "%"', v_name;
    when check_violation then
      raise exception 'choose a supported icon and color';
  end;

  return v_row;
end;
$$;

create or replace function public.update_pot_category(
  p_category_id uuid,
  p_name text,
  p_icon text,
  p_color text
)
returns public.pot_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_row public.pot_categories;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.pot_categories where id = p_category_id for update;
  if v_row is null or not public.is_pot_admin(v_row.pot_id) then
    raise exception 'only a pot admin can manage categories';
  end if;
  if v_name = '' then
    raise exception 'enter a category name';
  end if;
  if char_length(v_name) > 40 then
    raise exception 'category names can be at most 40 characters';
  end if;

  begin
    update public.pot_categories
    set name = v_name, icon = coalesce(p_icon, icon), color = coalesce(p_color, color)
    where id = p_category_id
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'this pot already has a category named "%"', v_name;
    when check_violation then
      raise exception 'choose a supported icon and color';
  end;

  return v_row;
end;
$$;

-- Archive (p_active = false) or restore (p_active = true). Never deletes.
create or replace function public.set_pot_category_active(
  p_category_id uuid,
  p_active boolean
)
returns public.pot_categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pot_categories;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.pot_categories where id = p_category_id for update;
  if v_row is null or not public.is_pot_admin(v_row.pot_id) then
    raise exception 'only a pot admin can manage categories';
  end if;

  if p_active and not v_row.is_active
     and (select count(*) from public.pot_categories where pot_id = v_row.pot_id and is_active)
         >= public.max_active_pot_categories() then
    raise exception 'a pot can have at most % active categories', public.max_active_pot_categories();
  end if;

  update public.pot_categories set is_active = p_active
  where id = p_category_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Persist a new order. Ids not listed (e.g. archived ones) keep their relative
-- order after the listed ones. Every id must belong to p_pot_id.
create or replace function public.reorder_pot_categories(
  p_pot_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := coalesce(array_length(p_category_ids, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_pot_admin(p_pot_id) then
    raise exception 'only a pot admin can manage categories';
  end if;
  if (select count(distinct x) from unnest(p_category_ids) x) <> v_count then
    raise exception 'duplicate category in order';
  end if;
  if exists (
    select 1 from unnest(p_category_ids) x
    where not exists (select 1 from public.pot_categories c where c.id = x and c.pot_id = p_pot_id)
  ) then
    raise exception 'category does not belong to this pot';
  end if;

  update public.pot_categories c
  set sort_order = r.new_order
  from (
    select id, row_number() over (order by listed, ord, sort_order, created_at) as new_order
    from (
      select c2.id, c2.sort_order, c2.created_at,
             (l.ord is null) as listed,
             coalesce(l.ord, 0) as ord
      from public.pot_categories c2
      left join unnest(p_category_ids) with ordinality as l(id, ord) on l.id = c2.id
      where c2.pot_id = p_pot_id
    ) s
  ) r
  where c.id = r.id and c.sort_order <> r.new_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Commitment RPCs now take category_id instead of free text.
-- ---------------------------------------------------------------------------
drop function if exists public.create_commitment(uuid, text, text, text, text, bigint, date);
drop function if exists public.update_commitment(uuid, text, text, text, text, bigint, date);

create or replace function public.create_commitment(
  p_pot_id uuid,
  p_title text,
  p_vendor_name text,
  p_category_id uuid,
  p_description text,
  p_total_amount bigint,
  p_due_date date
)
returns public.commitments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.pot_members;
  v_commitment public.commitments;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be greater than zero';
  end if;

  select * into v_member
    from public.pot_members
    where pot_id = p_pot_id and user_id = auth.uid() and status = 'active'
      and (role in ('owner', 'admin') or access_level = 'member');
  if v_member is null then
    raise exception 'not authorized to create Commitments in this pot';
  end if;

  insert into public.commitments (
    pot_id, title, vendor_name, category_id, description, total_amount, due_date, status, created_by
  ) values (
    p_pot_id, trim(p_title),
    nullif(trim(coalesce(p_vendor_name, '')), ''),
    p_category_id,
    nullif(trim(coalesce(p_description, '')), ''),
    p_total_amount, p_due_date, 'planned', v_member.id
  )
  returning * into v_commitment;

  return v_commitment;
end;
$$;

create or replace function public.update_commitment(
  p_commitment_id uuid,
  p_title text,
  p_vendor_name text,
  p_category_id uuid,
  p_description text,
  p_total_amount bigint,
  p_due_date date
)
returns public.commitments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commitment public.commitments;
  v_member public.pot_members;
begin
  select * into v_commitment from public.commitments where id = p_commitment_id for update;
  if v_commitment is null then raise exception 'commitment not found'; end if;
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'title is required'; end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be greater than zero';
  end if;

  select * into v_member
    from public.pot_members
    where pot_id = v_commitment.pot_id and user_id = auth.uid() and status = 'active';
  if v_member is null or not (
    v_member.role in ('owner', 'admin')
    or (v_member.access_level = 'member' and v_commitment.created_by = v_member.id)
  ) then
    raise exception 'not authorized to edit this commitment';
  end if;

  update public.commitments
    set title = trim(p_title),
        vendor_name = nullif(trim(coalesce(p_vendor_name, '')), ''),
        category_id = p_category_id,
        description = nullif(trim(coalesce(p_description, '')), ''),
        total_amount = p_total_amount,
        due_date = p_due_date,
        updated_at = now()
    where id = p_commitment_id
    returning * into v_commitment;

  return v_commitment;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_pot: categories go after the rows that reference them.
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

  if not public.is_pot_owner(p_pot_id) then
    raise exception 'Only the pot owner can delete this pot';
  end if;

  delete from public.commitment_payments where pot_id = p_pot_id;
  delete from public.commitments where pot_id = p_pot_id;

  delete from public.transaction_splits
  where transaction_id in (select id from public.transactions where pot_id = p_pot_id);

  delete from public.transactions where pot_id = p_pot_id;
  delete from public.pot_categories where pot_id = p_pot_id;
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

-- ---------------------------------------------------------------------------
-- Realtime + grants
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.pot_categories;
exception
  when duplicate_object then null;
end;
$$;

revoke all on function public.seed_default_pot_categories(uuid) from public;
revoke all on function public.pots_seed_categories() from public;
revoke all on function public.enforce_transaction_category() from public;
revoke all on function public.enforce_commitment_category() from public;
revoke all on function public.create_pot_category(uuid, text, text, text) from public;
revoke all on function public.update_pot_category(uuid, text, text, text) from public;
revoke all on function public.set_pot_category_active(uuid, boolean) from public;
revoke all on function public.reorder_pot_categories(uuid, uuid[]) from public;

grant execute on function public.max_active_pot_categories() to authenticated;
grant execute on function public.create_pot_category(uuid, text, text, text) to authenticated;
grant execute on function public.update_pot_category(uuid, text, text, text) to authenticated;
grant execute on function public.set_pot_category_active(uuid, boolean) to authenticated;
grant execute on function public.reorder_pot_categories(uuid, uuid[]) to authenticated;
grant execute on function public.create_commitment(uuid, text, text, uuid, text, bigint, date) to authenticated;
grant execute on function public.update_commitment(uuid, text, text, uuid, text, bigint, date) to authenticated;
