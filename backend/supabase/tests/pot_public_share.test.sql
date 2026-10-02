-- Database tests for 0019_public_pot_sharing.sql.
--
-- Run against a SCRATCH database that has migrations 0008..0019 applied
-- (never a real project):
--
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/pot_public_share.test.sql
--
-- The scratch database needs Supabase's `anon` / `authenticated` roles, an
-- `auth.users` table and `auth.uid()` reading `request.jwt.claim.sub`, plus
-- Supabase's default privileges (new public tables/functions open to the API
-- roles) so the revokes in the migration are actually exercised.
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

create function ptest.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

create function ptest.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
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

create table ptest.ctx (k text primary key, v uuid);
create table ptest.tok (k text primary key, v text);
grant all on ptest.ctx, ptest.tok to public;

create function ptest.goa() returns uuid language sql stable as $$ select v from ptest.ctx where k = 'goa' $$;
create function ptest.mus() returns uuid language sql stable as $$ select v from ptest.ctx where k = 'mus' $$;
create function ptest.tk(p_k text) returns text language sql stable as $$ select v from ptest.tok where k = p_k $$;

grant execute on all functions in schema ptest to public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000bb01', 'owner@test'),
  ('00000000-0000-0000-0000-00000000bb02', 'admin@test'),
  ('00000000-0000-0000-0000-00000000bb03', 'member@test'),
  ('00000000-0000-0000-0000-00000000bb04', 'viewer@test'),
  ('00000000-0000-0000-0000-00000000bb06', 'outsider@test'),
  ('00000000-0000-0000-0000-00000000bb07', 'removed@test');

-- Goa (owner bb01) and Mussoorie (owner bb06).
select ptest.as_user('00000000-0000-0000-0000-00000000bb01');
insert into ptest.ctx values ('goa', public.create_pot('Goa Trip 2026', 'Beach week'));
select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
insert into ptest.ctx values ('mus', public.create_pot('Mussoorie 2026'));
select ptest.as_postgres();

insert into public.pot_members (pot_id, user_id, display_name, role, access_level, status)
select ptest.goa(), u.id, u.n, u.r, u.a, u.s from (values
  ('00000000-0000-0000-0000-00000000bb02'::uuid, 'Asha Admin',  'admin',  'member',    'active'),
  ('00000000-0000-0000-0000-00000000bb03'::uuid, 'Mohan Member', 'member', 'member',    'active'),
  ('00000000-0000-0000-0000-00000000bb04'::uuid, 'Vera Viewer',  'member', 'view_only', 'active'),
  ('00000000-0000-0000-0000-00000000bb07'::uuid, 'Rita Removed', 'member', 'member',    'inactive')
) as u(id, n, r, a, s);
-- A member with no account at all.
insert into public.pot_members (pot_id, user_id, display_name, role, access_level)
values (ptest.goa(), null, 'Riya Guest', 'member', 'member');

-- Goa ledger. 'SECRET NOTE' must never appear publicly.
do $$
declare
  v_pot uuid := ptest.goa();
  v_owner uuid := (select id from public.pot_members where pot_id = v_pot and role = 'owner');
  v_riya uuid := (select id from public.pot_members where pot_id = v_pot and display_name = 'Riya Guest');
  v_mohan uuid := (select id from public.pot_members where pot_id = v_pot and display_name = 'Mohan Member');
  v_bank uuid := (select id from public.pool_accounts where pot_id = v_pot and type = 'bank' limit 1);
  v_cash uuid := (select id from public.pool_accounts where pot_id = v_pot and type = 'cash' limit 1);
  v_food uuid := (select id from public.pot_categories where pot_id = v_pot and name = 'Food');
begin
  insert into public.transactions (pot_id, type, description, amount, date, paid_by, created_by, pool_account_id, received_via, note)
  values
    (v_pot, 'contribution', 'Owner top-up', 10000, '2026-03-01', v_owner, v_owner, v_bank, 'online', 'SECRET NOTE c1'),
    (v_pot, 'contribution', 'Riya cash', 5000, '2026-03-02', v_riya, v_owner, v_cash, 'cash', null);

  insert into public.transactions (pot_id, type, description, amount, date, paid_by, created_by, pool_account_id, payment_source, category_id, participants, split_method, note)
  values (v_pot, 'pool_expense', 'Beach shack lunch', 3000, '2026-03-03', v_owner, v_owner, v_bank, 'pool', v_food,
          array[v_owner, v_riya], 'equal', 'SECRET NOTE e1');

  insert into public.transactions (pot_id, type, description, amount, date, paid_by, created_by, payment_source, participants, split_method, note)
  values (v_pot, 'member_expense', 'Taxi to airport', 2000, '2026-03-04', v_mohan, v_owner, 'personal',
          array[v_owner, v_mohan], 'equal', 'SECRET NOTE e2');

  insert into public.transactions (pot_id, type, description, amount, date, paid_by, to_member, created_by, payment_method, note)
  values (v_pot, 'settlement', 'Settle up', 500, '2026-03-05', v_riya, v_owner, v_owner, 'upi', 'SECRET NOTE s1');

  -- Internal bookkeeping: must be ignored by the public view. The pool trigger
  -- wants an acting admin/manager, so act as the owner for this one insert.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000bb01', true);
  insert into public.transactions (pot_id, type, description, amount, date, paid_by, created_by, pool_account_id, to_pool_account_id, note)
  values (v_pot, 'pool_transfer', 'POOL-TRANSFER-HIDDEN', 1000, '2026-03-06', v_owner, v_owner, v_bank, v_cash, null);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Mussoorie ledger (must never leak into Goa's public view).
do $$
declare
  v_pot uuid := ptest.mus();
  v_owner uuid := (select id from public.pot_members where pot_id = v_pot and role = 'owner');
  v_bank uuid := (select id from public.pool_accounts where pot_id = v_pot and type = 'bank' limit 1);
begin
  insert into public.transactions (pot_id, type, description, amount, date, paid_by, created_by, pool_account_id, received_via)
  values (v_pot, 'contribution', 'MUSSOORIE-ONLY', 77700, '2026-04-01', v_owner, v_owner, v_bank, 'online');
end $$;

-- Codes that must never appear in a public payload (captured while privileged).
insert into ptest.tok
select 'invite', invite_code from public.pots where id = ptest.goa()
union all
select 'join', join_code from public.pots where id = ptest.goa();

-- ---------------------------------------------------------------------------
-- Off by default
-- ---------------------------------------------------------------------------
select ptest.ok((select count(*) from public.pot_public_share) = 0,
  'no pot is shared until someone enables it');

select ptest.as_user('00000000-0000-0000-0000-00000000bb01');
select ptest.ok((select enabled from public.get_pot_public_share(ptest.goa())) = false, 'owner sees sharing off');
select ptest.ok((select token from public.get_pot_public_share(ptest.goa())) is null, 'no token while off');
select ptest.ok((select can_manage from public.get_pot_public_share(ptest.goa())), 'owner can manage');

select ptest.as_user('00000000-0000-0000-0000-00000000bb03');
select ptest.ok(not (select can_manage from public.get_pot_public_share(ptest.goa())), 'plain member cannot manage');

select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
select ptest.expect_error($$select * from public.get_pot_public_share(ptest.goa())$$, 'not a member');

select ptest.as_user('00000000-0000-0000-0000-00000000bb07');
select ptest.expect_error($$select * from public.get_pot_public_share(ptest.goa())$$, 'not a member');  -- removed member

select ptest.as_anon();
select ptest.expect_error($$select * from public.get_pot_public_share(ptest.goa())$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Enabling: owner/admin only
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000bb03');
select ptest.expect_error($$select * from public.enable_pot_public_share(ptest.goa())$$, 'only a pot admin');
select ptest.as_user('00000000-0000-0000-0000-00000000bb04');
select ptest.expect_error($$select * from public.enable_pot_public_share(ptest.goa())$$, 'only a pot admin');
select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
select ptest.expect_error($$select * from public.enable_pot_public_share(ptest.goa())$$, 'only a pot admin');
select ptest.as_user('00000000-0000-0000-0000-00000000bb07');
select ptest.expect_error($$select * from public.enable_pot_public_share(ptest.goa())$$, 'only a pot admin');
select ptest.as_anon();
select ptest.expect_error($$select * from public.enable_pot_public_share(ptest.goa())$$, 'permission denied');
select ptest.as_postgres();
select ptest.ok((select count(*) from public.pot_public_share) = 0, 'failed enables created nothing');

-- An admin (not just the owner) can enable.
select ptest.as_user('00000000-0000-0000-0000-00000000bb02');
insert into ptest.tok select 'goa', token from public.enable_pot_public_share(ptest.goa());
select ptest.ok(ptest.tk('goa') ~ '^[A-Za-z0-9_-]{43}$', 'token is 43 url-safe chars');
select ptest.ok(ptest.tk('goa') !~ ptest.goa()::text, 'token does not contain the pot id');

-- Idempotent: the owner enabling again returns the same live link.
select ptest.as_user('00000000-0000-0000-0000-00000000bb01');
select ptest.ok((select token from public.enable_pot_public_share(ptest.goa())) = ptest.tk('goa'),
  'enabling twice keeps the same token');
select ptest.as_postgres();
select ptest.ok((select count(*) from public.pot_public_share where pot_id = ptest.goa()) = 1, 'one row per live link');

-- Another pot gets an unrelated token.
select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
insert into ptest.tok select 'mus', token from public.enable_pot_public_share(ptest.mus());
select ptest.ok(ptest.tk('mus') <> ptest.tk('goa'), 'tokens are unique per pot');

-- Members (any access level) can read the live link; outsiders still cannot.
select ptest.as_user('00000000-0000-0000-0000-00000000bb04');
select ptest.ok((select token from public.get_pot_public_share(ptest.goa())) = ptest.tk('goa'), 'view-only member can read the link');
select ptest.ok(not (select can_manage from public.get_pot_public_share(ptest.goa())), '...but not manage it');
select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
select ptest.expect_error($$select * from public.get_pot_public_share(ptest.goa())$$, 'not a member');

-- ---------------------------------------------------------------------------
-- Public read: anonymous
-- ---------------------------------------------------------------------------
select ptest.as_anon();
create temp table pub on commit drop as select public.get_public_pot(ptest.tk('goa')) as d;
grant all on pub to public;

select ptest.ok((select d->>'status' from pub) = 'ok', 'anon can open a valid link');
select ptest.ok((select d->'pot'->>'name' from pub) = 'Goa Trip 2026', 'pot name');
select ptest.ok((select d->'pot'->>'description' from pub) = 'Beach week', 'pot description');
select ptest.ok((select (d->'pot'->>'archived')::boolean from pub) = false, 'not archived');
select ptest.ok((select (d->'summary'->>'contributed')::bigint from pub) = 15000, 'contributed total');
select ptest.ok((select (d->'summary'->>'spent')::bigint from pub) = 5000, 'spent = pool + member expenses');
select ptest.ok((select (d->'summary'->>'balance')::bigint from pub) = 12000, 'balance = contributions - pool expenses (transfers ignored)');
select ptest.ok((select (d->'summary'->>'member_count')::int from pub) = 5, 'active members only (removed member excluded)');
select ptest.ok((select (d->'summary'->>'transaction_count')::int from pub) = 5, 'five ledger rows; the pool transfer is not counted');
select ptest.ok((select jsonb_array_length(d->'transactions') from pub) = 5, 'five rows returned');
select ptest.ok((select not (d->>'transactions_truncated')::boolean from pub), 'not truncated');
select ptest.ok((select d->'viewer_pot_id' from pub) = 'null'::jsonb, 'anon gets no viewer pot id');

select ptest.ok((select d->'transactions'->0->>'description' from pub) = 'Settle up', 'newest first');
select ptest.ok((select d->'transactions'->4->>'description' from pub) = 'Owner top-up', 'oldest last');
select ptest.ok((select d->'transactions'->0->>'paid_by' from pub) = 'Riya Guest'
             and (select d->'transactions'->0->>'to' from pub) = 'owner', 'settlement names payer and receiver');
select ptest.ok((select d->'transactions'->2->'category'->>'name' from pub) = 'Food', 'category resolved by name');
select ptest.ok((select d->'transactions'->2->'category'->>'icon' from pub) is not null
             and (select d->'transactions'->2->'category'->>'color' from pub) is not null, 'category carries icon + color keys');
select ptest.ok((select d->'transactions'->2->'participants' from pub) @> '["Riya Guest"]'::jsonb
             and (select jsonb_array_length(d->'transactions'->2->'participants') from pub) = 2, 'expense participants are names');
select ptest.ok((select d->'transactions'->0->'participants' from pub) = '[]'::jsonb, 'settlements have no participants');
select ptest.ok((select jsonb_array_length(d->'members') from pub) = 5, 'five members listed');
select ptest.ok((select bool_and(m ? 'name' and m ? 'contributed' and (select count(*) from jsonb_object_keys(m)) = 2)
                 from pub, jsonb_array_elements(d->'members') m), 'member entries expose only name + contributed');

-- Privacy: nothing but allow-listed fields, and nothing identifying.
select ptest.ok((select d::text from pub) !~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
  'response contains no UUID of any kind');
select ptest.ok((select d::text from pub) !~ '"(id|pot_id|user_id|member_id|created_by|email|phone|note|role|access_level|invite_code|join_code|avatar|token|public_token|category_id)"\s*:',
  'response has no sensitive keys');
select ptest.ok((select d::text from pub) not like '%SECRET NOTE%', 'transaction notes are not exposed');
select ptest.ok((select d::text from pub) not like '%@test%', 'no email addresses');
select ptest.ok((select d::text from pub) not like '%POOL-TRANSFER-HIDDEN%', 'pool transfers are not exposed');
select ptest.ok((select d::text from pub) not like '%MUSSOORIE-ONLY%', 'other pots never leak');
select ptest.ok((select d::text from pub) not like '%Rita Removed%', 'removed member is not listed');
select ptest.ok(not exists (select 1 from pub where d ? 'commitments' or d ? 'join_requests' or d ? 'notifications'),
  'planned payments / join requests / notifications are not part of the payload');
select ptest.ok((select d::text from pub) not like ('%' || ptest.tk('invite') || '%'), 'no invite code');
select ptest.ok((select d::text from pub) not like ('%' || ptest.tk('join') || '%'), 'no join code');

-- The other pot is isolated the same way.
select ptest.ok((select public.get_public_pot(ptest.tk('mus'))->'pot'->>'name') = 'Mussoorie 2026', 'the Mussoorie link shows Mussoorie');
select ptest.ok((select public.get_public_pot(ptest.tk('mus'))::text) like '%MUSSOORIE-ONLY%', '...with its own ledger');
select ptest.ok((select public.get_public_pot(ptest.tk('mus'))::text) not like '%Beach shack%', '...and none of Goa''s');

-- ---------------------------------------------------------------------------
-- Public read: bad tokens
-- ---------------------------------------------------------------------------
select ptest.ok(public.get_public_pot(null)->>'status' = 'not_found', 'null token');
select ptest.ok(public.get_public_pot('')->>'status' = 'not_found', 'empty token');
select ptest.ok(public.get_public_pot('abc')->>'status' = 'not_found', 'short token');
select ptest.ok(public.get_public_pot(repeat('A', 43))->>'status' = 'not_found', 'well-formed but unknown token');
select ptest.ok(public.get_public_pot(ptest.tk('goa') || 'x')->>'status' = 'not_found', 'token with extra character');
select ptest.ok(public.get_public_pot(substr(ptest.tk('goa'), 1, 42))->>'status' = 'not_found', 'truncated token');
select ptest.ok(public.get_public_pot(swapcase_probe)->>'status' = 'not_found', 'case-flipped token')
  from (select translate(ptest.tk('goa'), 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') as swapcase_probe) s;
select ptest.ok(public.get_public_pot(ptest.goa()::text)->>'status' = 'not_found', 'the internal pot id is not a valid token');
select ptest.ok(public.get_public_pot(ptest.tk('goa') || ''' OR 1=1 --')->>'status' = 'not_found', 'SQL-ish suffix');
select ptest.ok(public.get_public_pot('%')->>'status' = 'not_found', 'LIKE wildcard');
select ptest.ok(public.get_public_pot(repeat('A', 500))->>'status' = 'not_found', 'oversized token');
select ptest.ok(public.get_public_pot(' ' || ptest.tk('goa'))->>'status' = 'not_found', 'leading space is not trimmed into a match');

-- ---------------------------------------------------------------------------
-- Anonymous callers cannot reach any table or mutate anything
-- ---------------------------------------------------------------------------
select ptest.as_anon();
select ptest.ok((select count(*) from public.pots) = 0, 'anon reads no pots');
select ptest.ok((select count(*) from public.pot_members) = 0, 'anon reads no members');
select ptest.ok((select count(*) from public.transactions) = 0, 'anon reads no transactions');
select ptest.ok((select count(*) from public.transaction_splits) = 0, 'anon reads no splits');
select ptest.ok((select count(*) from public.users) = 0, 'anon reads no users');
select ptest.ok((select count(*) from public.pot_categories) = 0, 'anon reads no categories');
select ptest.ok((select count(*) from public.join_requests) = 0, 'anon reads no join requests');
select ptest.ok((select count(*) from public.commitments) = 0, 'anon reads no commitments');
select ptest.expect_error($$select * from public.pot_public_share$$, 'permission denied');
select ptest.expect_error($$insert into public.pot_public_share (pot_id, public_token) values (ptest.goa(), repeat('B', 43))$$, 'permission denied');
select ptest.expect_error($$update public.pot_public_share set is_enabled = true$$, 'permission denied');
select ptest.expect_error($$delete from public.pot_public_share$$, 'permission denied');
select ptest.expect_error($$insert into public.transactions (pot_id, type, description, amount, date, created_by) values (ptest.goa(), 'contribution', 'x', 1, current_date, ptest.goa())$$, '');  -- any failure: a BEFORE trigger can reject it before RLS is evaluated
select ptest.expect_error($$insert into public.pot_members (pot_id, display_name) values (ptest.goa(), 'Intruder')$$, 'row-level security');
select ptest.expect_error($$insert into public.join_requests (pot_id, user_id, requested_name) values (ptest.goa(), '00000000-0000-0000-0000-00000000bb06', 'x')$$, 'row-level security');
select ptest.expect_error($$select public.generate_public_share_token()$$, 'permission denied');
do $$
declare n int;
begin
  update public.pots set name = 'pwned';
  get diagnostics n = row_count;
  perform ptest.ok(n = 0, 'anon updates no pots');
  delete from public.transactions;
  get diagnostics n = row_count;
  perform ptest.ok(n = 0, 'anon deletes no transactions');
  update public.pot_members set role = 'owner';
  get diagnostics n = row_count;
  perform ptest.ok(n = 0, 'anon promotes no members');
end $$;
select ptest.expect_error($$select public.create_pot('anon pot')$$, 'profile not found');
select ptest.expect_error($$select public.disable_pot_public_share(ptest.goa())$$, 'permission denied');

-- Signed-in users don't get table access to the share table either.
select ptest.as_user('00000000-0000-0000-0000-00000000bb01');
select ptest.expect_error($$select * from public.pot_public_share$$, 'permission denied');
select ptest.expect_error($$update public.pot_public_share set is_enabled = true$$, 'permission denied');
select ptest.expect_error($$select public.generate_public_share_token()$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Signed-in viewers of a public link
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000bb03');
select ptest.ok((select public.get_public_pot(ptest.tk('goa'))->>'viewer_pot_id') = ptest.goa()::text,
  'an active member is told which pot to open in the app');

select ptest.as_user('00000000-0000-0000-0000-00000000bb06');  -- Mussoorie owner, not in Goa
select ptest.ok(public.get_public_pot(ptest.tk('goa'))->'viewer_pot_id' = 'null'::jsonb, 'a non-member gets no pot id');
select ptest.ok(public.get_public_pot(ptest.tk('goa'))->>'status' = 'ok', '...but still sees the public view');

select ptest.as_user('00000000-0000-0000-0000-00000000bb07');  -- removed member
select ptest.ok(public.get_public_pot(ptest.tk('goa'))->'viewer_pot_id' = 'null'::jsonb, 'a removed member gets no pot id');

select ptest.as_postgres();
select ptest.ok((select count(*) from public.pot_members where pot_id = ptest.goa() and user_id = '00000000-0000-0000-0000-00000000bb06') = 0,
  'viewing a public link never creates a membership');
select ptest.ok((select count(*) from public.join_requests where pot_id = ptest.goa()) = 0, '...or a join request');

-- ---------------------------------------------------------------------------
-- Disabling kills the link immediately
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000bb03');
select ptest.expect_error($$select public.disable_pot_public_share(ptest.goa())$$, 'only a pot admin');
select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
select ptest.expect_error($$select public.disable_pot_public_share(ptest.goa())$$, 'only a pot admin');
select ptest.as_anon();
select ptest.ok(public.get_public_pot(ptest.tk('goa'))->>'status' = 'ok', 'link still live after refused disables');

select ptest.as_user('00000000-0000-0000-0000-00000000bb02');
select public.disable_pot_public_share(ptest.goa());
select ptest.as_anon();
select ptest.ok(public.get_public_pot(ptest.tk('goa'))->>'status' = 'revoked', 'disabled link reports revoked');
select ptest.ok(not (public.get_public_pot(ptest.tk('goa')) ? 'pot'), 'a revoked link returns no pot data at all');
select ptest.ok(public.get_public_pot(ptest.tk('mus'))->>'status' = 'ok', 'disabling one pot does not touch another');

select ptest.as_user('00000000-0000-0000-0000-00000000bb01');
select ptest.ok((select enabled from public.get_pot_public_share(ptest.goa())) = false, 'share state shows off');
select ptest.ok((select token from public.get_pot_public_share(ptest.goa())) is null, '...and no token');
select public.disable_pot_public_share(ptest.goa());  -- idempotent
select ptest.as_postgres();
select ptest.ok((select revoked_at is not null and not is_enabled from public.pot_public_share where public_token = ptest.tk('goa')),
  'revoked row is kept with revoked_at set');

-- Re-enabling issues a brand new token; the old one stays dead.
select ptest.as_user('00000000-0000-0000-0000-00000000bb01');
insert into ptest.tok select 'goa2', token from public.enable_pot_public_share(ptest.goa());
select ptest.ok(ptest.tk('goa2') <> ptest.tk('goa'), 're-enabling rotates the token');
select ptest.as_anon();
select ptest.ok(public.get_public_pot(ptest.tk('goa'))->>'status' = 'revoked', 'old link stays revoked');
select ptest.ok(public.get_public_pot(ptest.tk('goa2'))->>'status' = 'ok', 'new link works');
select ptest.as_postgres();
select ptest.ok((select count(*) from public.pot_public_share where pot_id = ptest.goa()) = 2, 'history kept: revoked + live');
select ptest.ok((select count(*) from public.pot_public_share where pot_id = ptest.goa() and is_enabled) = 1, 'exactly one live link');

-- ---------------------------------------------------------------------------
-- Table constraints
-- ---------------------------------------------------------------------------
select ptest.expect_error($$insert into public.pot_public_share (pot_id, public_token) values (ptest.goa(), 'short')$$, 'pot_public_share_token_format');
select ptest.expect_error($$insert into public.pot_public_share (pot_id, public_token) values (ptest.goa(), repeat('A', 31) || '!')$$, 'pot_public_share_token_format');
select ptest.expect_error($$insert into public.pot_public_share (pot_id, public_token) values (ptest.goa(), repeat('C', 43))$$, 'pot_public_share_one_active_per_pot');
select ptest.expect_error($$insert into public.pot_public_share (pot_id, public_token) values (ptest.mus(), ptest.tk('mus'))$$, 'duplicate key');
select ptest.expect_error($$insert into public.pot_public_share (pot_id, public_token, is_enabled) values (ptest.goa(), repeat('D', 43), false)$$, 'pot_public_share_revoked_consistent');
select ptest.ok((select relrowsecurity from pg_class where oid = 'public.pot_public_share'::regclass), 'RLS is enabled on pot_public_share');
select ptest.ok((select count(*) from pg_policies where tablename = 'pot_public_share') = 0, 'and it has no policies (deny by default)');
select ptest.ok(exists (select 1 from pg_indexes where tablename = 'pot_public_share' and indexname = 'pot_public_share_token_key'),
  'token lookup is indexed');

-- ---------------------------------------------------------------------------
-- Large pots: totals stay exact, the list is capped
-- ---------------------------------------------------------------------------
do $$
declare
  v_pot uuid := ptest.mus();
  v_owner uuid := (select id from public.pot_members where pot_id = v_pot and role = 'owner');
  v_bank uuid := (select id from public.pool_accounts where pot_id = v_pot and type = 'bank' limit 1);
begin
  insert into public.transactions (pot_id, type, description, amount, date, paid_by, created_by, pool_account_id, received_via)
  select v_pot, 'contribution', 'bulk ' || g, 100, date '2026-05-01' + (g % 20), v_owner, v_owner, v_bank, 'online'
  from generate_series(1, 600) g;
end $$;
select ptest.as_anon();
create temp table big on commit drop as select public.get_public_pot(ptest.tk('mus')) as d;
grant all on big to public;
select ptest.ok((select jsonb_array_length(d->'transactions') from big) = 500, 'transaction list is capped at 500');
select ptest.ok((select (d->>'transactions_truncated')::boolean from big), 'and flagged as truncated');
select ptest.ok((select (d->'summary'->>'transaction_count')::int from big) = 601, 'count covers the whole ledger');
select ptest.ok((select (d->'summary'->>'contributed')::bigint from big) = 77700 + 600 * 100, 'totals cover the whole ledger, not just the page');

-- ---------------------------------------------------------------------------
-- Deleting the pot removes the link
-- ---------------------------------------------------------------------------
select ptest.as_user('00000000-0000-0000-0000-00000000bb06');
select public.delete_pot(ptest.mus());
select ptest.as_anon();
select ptest.ok(public.get_public_pot(ptest.tk('mus'))->>'status' = 'not_found', 'link to a deleted pot is not found');
select ptest.as_postgres();
select ptest.ok((select count(*) from public.pot_public_share where pot_id = ptest.mus()) = 0, 'share rows are removed with the pot');

do $$ begin raise notice 'pot_public_share tests: all assertions passed'; end $$;

rollback;
