-- Database tests for 0018_pot_categories.sql.
--
-- Run against a SCRATCH database that has migrations 0008..0018 applied
-- (never a real project):
--
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/pot_categories.test.sql
--
-- Everything runs in one transaction and is rolled back. A failed assertion
-- raises an exception and aborts the run; reaching the final NOTICE means every
-- assertion passed.

begin;

create schema ptest;
grant usage on schema ptest to public;

create function ptest.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function ptest.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end;
$$;

-- Runs p_sql and requires it to fail with a message containing p_fragment.
create function ptest.expect_error(p_sql text, p_fragment text) returns void
language plpgsql as $$
declare
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'EXPECTED ERROR "%" BUT SUCCEEDED: %', p_fragment, p_sql;
  end if;
  if position(lower(p_fragment) in lower(v_msg)) = 0 then
    raise exception 'EXPECTED ERROR "%" BUT GOT "%": %', p_fragment, v_msg, p_sql;
  end if;
end;
$$;

create function ptest.ok(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'ASSERTION FAILED: %', p_msg; end if;
end;
$$;

grant execute on all functions in schema ptest to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000aa01', 'owner@test'),
  ('00000000-0000-0000-0000-00000000aa02', 'admin@test'),
  ('00000000-0000-0000-0000-00000000aa03', 'member@test'),
  ('00000000-0000-0000-0000-00000000aa04', 'viewer@test'),
  ('00000000-0000-0000-0000-00000000aa05', 'manager@test'),
  ('00000000-0000-0000-0000-00000000aa06', 'outsider@test');

create table ptest.ctx (k text primary key, v uuid);
grant all on ptest.ctx to public;

-- Goa (owner aa01) and Mussoorie (owner aa06).
select ptest.as_user('00000000-0000-0000-0000-00000000aa01');
insert into ptest.ctx values ('goa', public.create_pot('Goa 2026'));
select ptest.as_user('00000000-0000-0000-0000-00000000aa06');
insert into ptest.ctx values ('mus', public.create_pot('Mussoorie 2026'));
select ptest.as_postgres();

insert into public.pot_members (pot_id, user_id, display_name, role, access_level)
select (select v from ptest.ctx where k = 'goa'), u.id, u.n, u.r, u.a from (values
  ('00000000-0000-0000-0000-00000000aa02'::uuid, 'Admin',   'admin',  'member'),
  ('00000000-0000-0000-0000-00000000aa03'::uuid, 'Member',  'member', 'member'),
  ('00000000-0000-0000-0000-00000000aa04'::uuid, 'Viewer',  'member', 'view_only'),
  ('00000000-0000-0000-0000-00000000aa05'::uuid, 'Manager', 'member', 'view_only')
) as u(id, n, r, a);

-- aa05 becomes the pool manager but is NOT a pot admin.
update public.pot_pool_managers set active = false
where pot_id = (select v from ptest.ctx where k = 'goa');
insert into public.pot_pool_managers (pot_id, pot_member_id)
select (select v from ptest.ctx where k = 'goa'),
       (select id from public.pot_members
        where pot_id = (select v from ptest.ctx where k = 'goa')
          and user_id = '00000000-0000-0000-0000-00000000aa05');

create function ptest.goa() returns uuid language sql stable as $$ select v from ptest.ctx where k = 'goa' $$;
create function ptest.mus() returns uuid language sql stable as $$ select v from ptest.ctx where k = 'mus' $$;
create function ptest.cat(p_pot uuid, p_name text) returns uuid language sql stable as $$
  select id from public.pot_categories where pot_id = p_pot and lower(name) = lower(p_name)
$$;
create function ptest.member(p_pot uuid, p_user uuid) returns uuid language sql stable as $$
  select id from public.pot_members where pot_id = p_pot and user_id = p_user
$$;
create function ptest.muscat() returns uuid language sql stable security definer as $$
  select id from public.pot_categories where pot_id = ptest.mus() order by sort_order limit 1
$$;
grant execute on all functions in schema ptest to public;

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------
select ptest.ok(
  (select array_agg(name order by sort_order) from public.pot_categories where pot_id = ptest.goa())
  = array['Food','Transport','Accommodation','Activities','Shopping','Fuel','Tickets','Other'],
  'a new pot gets the default categories in order');
select ptest.ok(
  (select bool_and(is_active and is_default) from public.pot_categories where pot_id = ptest.goa()),
  'defaults are active and flagged is_default');

-- ---------------------------------------------------------------------------
-- Create, rename, icon, color, duplicates
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000aa01');
select public.create_pot_category(ptest.goa(), '  Beach   Activities ', 'sparkles', 'blue');
select ptest.ok(ptest.cat(ptest.goa(), 'Beach Activities') is not null, 'create trims and collapses whitespace');
select ptest.ok(
  (select sort_order from public.pot_categories where id = ptest.cat(ptest.goa(), 'Beach Activities')) = 9,
  'new category sorts after the existing ones');

select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'beach activities', 'tag', 'gray')$$, 'already has a category');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'FOOD', 'tag', 'gray')$$, 'already has a category');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), '   ', 'tag', 'gray')$$, 'enter a category name');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), repeat('x', 41), 'tag', 'gray')$$, '40 characters');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'Bad icon', 'skull', 'gray')$$, 'supported icon');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'Bad color', 'tag', '#ff00ff')$$, 'supported icon');

-- Same name in a different pot is fine.
select ptest.as_user('00000000-0000-0000-0000-00000000aa06');
select public.create_pot_category(ptest.mus(), 'Beach Activities', 'sparkles', 'blue');
select ptest.as_postgres();
select ptest.ok(ptest.cat(ptest.mus(), 'Beach Activities') <> ptest.cat(ptest.goa(), 'Beach Activities'),
  'the same name can exist in two pots');

select ptest.as_user('00000000-0000-0000-0000-00000000aa01');
-- Rename keeps the id (so history follows), change icon and color.
create temp table keep as select ptest.cat(ptest.goa(), 'Food') as id;
grant all on keep to public;
select public.update_pot_category((select id from keep), 'Food & Dining', 'coffee', 'green');
select ptest.ok(
  (select name = 'Food & Dining' and icon = 'coffee' and color = 'green' from public.pot_categories where id = (select id from keep)),
  'rename, icon and color update in place');
select ptest.expect_error(
  $$select public.update_pot_category(ptest.cat(ptest.goa(), 'Transport'), 'food & dining', 'car', 'blue')$$,
  'already has a category');

-- ---------------------------------------------------------------------------
-- Expenses reference category_id
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000aa03');  -- regular member
create temp table tx as select 1 as n;
grant all on tx to public;

insert into public.transactions (pot_id, type, description, amount, date, paid_by, payment_source, category_id, created_by)
values (ptest.goa(), 'member_expense', 'Dinner', 425000, current_date,
        ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa03'), 'personal',
        (select id from keep), ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa03'));

select ptest.ok((select count(*) from public.transactions where category_id = (select id from keep)) = 1,
  'expense stores category_id');

-- Cross-pot category is rejected by the database.
select ptest.expect_error(
  $$insert into public.transactions (pot_id, type, description, amount, date, paid_by, payment_source, category_id, created_by)
    values (ptest.goa(), 'member_expense', 'Wrong pot', 100, current_date,
            ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa03'), 'personal',
            ptest.muscat(),
            ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa03'))$$,
  'does not belong to this pot');

-- Non-expense rows cannot carry a category.
select ptest.as_postgres();
select ptest.expect_error(
  $$insert into public.transactions (pot_id, type, description, amount, date, paid_by, category_id, created_by,
                                     pool_account_id, received_via)
    values (ptest.goa(), 'contribution', 'Contribution', 100, current_date,
            ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa01'), (select id from keep),
            ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa01'),
            (select id from public.pool_accounts where pot_id = ptest.goa() and type = 'bank'), 'online')$$,
  'only expenses');

-- ---------------------------------------------------------------------------
-- Archive / restore
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000aa01');
select public.set_pot_category_active((select id from keep), false);
select ptest.ok(not (select is_active from public.pot_categories where id = (select id from keep)), 'archived');

-- Archived: cannot be chosen for a NEW expense...
select ptest.as_user('00000000-0000-0000-0000-00000000aa03');
select ptest.expect_error(
  $$insert into public.transactions (pot_id, type, description, amount, date, paid_by, payment_source, category_id, created_by)
    values (ptest.goa(), 'member_expense', 'New after archive', 100, current_date,
            ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa03'), 'personal', (select id from keep),
            ptest.member(ptest.goa(), '00000000-0000-0000-0000-00000000aa03'))$$,
  'archived');

-- ...but the historical expense keeps it and can still be edited without touching it.
update public.transactions set description = 'Dinner (edited)' where description = 'Dinner';
select ptest.ok(
  (select category_id = (select id from keep) from public.transactions where description = 'Dinner (edited)'),
  'archived category stays on the historical expense');

-- Used category cannot be hard-deleted even by a superuser path.
select ptest.as_postgres();
select ptest.expect_error($$delete from public.pot_categories where id = (select id from keep)$$, 'violates foreign key');

-- Restore.
select ptest.as_user('00000000-0000-0000-0000-00000000aa01');
select public.set_pot_category_active((select id from keep), true);
select ptest.ok((select is_active from public.pot_categories where id = (select id from keep)), 'restored');

-- ---------------------------------------------------------------------------
-- Reorder
-- ---------------------------------------------------------------------------
select public.reorder_pot_categories(ptest.goa(), array[
  ptest.cat(ptest.goa(), 'Other'), ptest.cat(ptest.goa(), 'Food & Dining')]);
select ptest.ok(
  (select array_agg(name order by sort_order) from public.pot_categories where pot_id = ptest.goa())[1:2]
  = array['Other', 'Food & Dining'],
  'listed ids come first, in the requested order');
select ptest.ok(
  (select count(distinct sort_order) = count(*) from public.pot_categories where pot_id = ptest.goa()),
  'sort_order stays unique after reorder');
select ptest.expect_error(
  $$select public.reorder_pot_categories(ptest.goa(), array[ptest.muscat()])$$,
  'does not belong to this pot');

-- ---------------------------------------------------------------------------
-- Active category limit
-- ---------------------------------------------------------------------------
do $$
declare i int;
begin
  for i in 1..(public.max_active_pot_categories() - (select count(*) from public.pot_categories where pot_id = ptest.goa() and is_active)::int) loop
    perform public.create_pot_category(ptest.goa(), 'Filler ' || i, 'tag', 'gray');
  end loop;
end $$;
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'One too many', 'tag', 'gray')$$, 'at most');

-- ---------------------------------------------------------------------------
-- Permissions and RLS
-- ---------------------------------------------------------------------------
-- Pot admin (role = admin) may manage; plain member, view-only, pool manager and outsiders may not.
select ptest.as_user('00000000-0000-0000-0000-00000000aa02');
select public.update_pot_category(ptest.cat(ptest.goa(), 'Fuel'), 'Fuel & Gas', 'fuel', 'red');

select ptest.as_user('00000000-0000-0000-0000-00000000aa03');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'Nope', 'tag', 'gray')$$, 'only a pot admin');
select ptest.expect_error($$select public.update_pot_category(ptest.cat(ptest.goa(), 'Fuel & Gas'), 'X', 'tag', 'gray')$$, 'only a pot admin');
select ptest.expect_error($$select public.set_pot_category_active(ptest.cat(ptest.goa(), 'Fuel & Gas'), false)$$, 'only a pot admin');
select ptest.expect_error($$select public.reorder_pot_categories(ptest.goa(), array[]::uuid[])$$, 'only a pot admin');

select ptest.as_user('00000000-0000-0000-0000-00000000aa04');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'Nope', 'tag', 'gray')$$, 'only a pot admin');

select ptest.as_user('00000000-0000-0000-0000-00000000aa05');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'Nope', 'tag', 'gray')$$, 'only a pot admin');

-- Another pot's owner cannot touch Goa's categories by id or by pot_id.
select ptest.as_user('00000000-0000-0000-0000-00000000aa06');
select ptest.expect_error($$select public.create_pot_category(ptest.goa(), 'Nope', 'tag', 'gray')$$, 'only a pot admin');
select ptest.expect_error($$select public.update_pot_category(ptest.cat(ptest.goa(), 'Fuel & Gas'), 'X', 'tag', 'gray')$$, 'only a pot admin');
select ptest.expect_error($$select public.set_pot_category_active(ptest.cat(ptest.goa(), 'Fuel & Gas'), false)$$, 'only a pot admin');

-- Direct table writes are denied for everyone (RLS has no write policies).
select ptest.as_user('00000000-0000-0000-0000-00000000aa01');
do $$
declare n int;
begin
  update public.pot_categories set name = 'hacked' where pot_id = ptest.goa();
  get diagnostics n = row_count;
  perform ptest.ok(n = 0, 'owner cannot update categories directly');
end $$;
select ptest.expect_error(
  $$insert into public.pot_categories (pot_id, name) values (ptest.goa(), 'direct')$$, 'row-level security');

-- Reads: members see their pot's categories only.
select ptest.ok((select count(*) from public.pot_categories where pot_id = ptest.mus()) = 0, 'goa owner cannot read mussoorie categories');
select ptest.as_user('00000000-0000-0000-0000-00000000aa04');
select ptest.ok((select count(*) from public.pot_categories where pot_id = ptest.goa()) > 0, 'view-only member can read categories');
select ptest.as_user('00000000-0000-0000-0000-00000000aa06');
select ptest.ok((select count(*) from public.pot_categories where pot_id = ptest.goa()) = 0, 'outsider cannot read goa categories');
select ptest.ok((select count(*) from public.pot_categories where pot_id = ptest.mus()) > 0, 'mussoorie owner reads own categories');

-- ---------------------------------------------------------------------------
-- Upcoming payments
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000aa03');
select public.create_commitment(ptest.goa(), 'Hotel', null, ptest.cat(ptest.goa(), 'Accommodation'), null, 900000, null);
select ptest.expect_error(
  $$select public.create_commitment(ptest.goa(), 'Wrong pot', null,
        ptest.muscat(), null, 100, null)$$,
  'does not belong to this pot');

-- ---------------------------------------------------------------------------
-- Money is untouched by relabelling
-- ---------------------------------------------------------------------------
select ptest.as_postgres();
select ptest.ok(
  (select amount from public.transactions where description = 'Dinner (edited)') = 425000,
  'amount unchanged by archive / rename / restore');

do $$ begin raise notice 'pot_categories tests: all assertions passed'; end $$;

rollback;
