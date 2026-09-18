-- NEW: zero-cost Join Code method (manual entry / QR), additive to the
-- EXISTING invite-link columns from 0001 (pots.invite_code, pots.invite_enabled),
-- which this migration does not touch, rename, or repurpose in any way.
--
-- NOT CONNECTED to a live Supabase project (see note in 0001). Written as a
-- realistic, safe ALTER + backfill so it's a drop-in whenever a real
-- Supabase project is adopted.

alter table pots add column if not exists join_code text;
alter table pots add column if not exists join_enabled boolean not null default true;

-- Safe backfill for pre-existing rows: generate a random 6-char code per pot
-- that doesn't already exist, retrying on collision. (The app's own
-- generateJoinCode() in src/logic/invites.ts performs the equivalent
-- collision-checked generation for newly-created pots; this loop mirrors it
-- for rows that predate the join_code column.)
do $$
declare
  r record;
  candidate text;
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- matches JOIN_CODE_ALPHABET in src/logic/invites.ts
  attempt int;
begin
  for r in select id from pots where join_code is null loop
    attempt := 0;
    loop
      candidate := '';
      for i in 1..6 loop
        candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      attempt := attempt + 1;
      exit when not exists (select 1 from pots where join_code = candidate) or attempt > 20;
    end loop;
    update pots set join_code = candidate where id = r.id;
  end loop;
end $$;

alter table pots alter column join_code set not null;

-- Unique across Pots, exactly like invite_code — a separate constraint on a
-- separate column, so neither identity space can collide with the other.
create unique index if not exists pots_join_code_unique on pots (join_code);

-- No changes to join_requests or its constraints: both the invite-link and
-- Join Code channels create rows in the same join_requests table, so no
-- second membership/request architecture is introduced here.
