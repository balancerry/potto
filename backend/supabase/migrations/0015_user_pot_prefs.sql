-- Per-user home-list preferences (synced across web + mobile).
-- pinned_pot_ids: ordered array of pot UUIDs (max 3 enforced in app).
-- pot_visits: { "<pot_id>": "<ISO timestamptz>" }

alter table public.users
  add column if not exists pinned_pot_ids jsonb not null default '[]'::jsonb,
  add column if not exists pot_visits jsonb not null default '{}'::jsonb;

comment on column public.users.pinned_pot_ids is
  'Ordered pot ids pinned to the top of the home list (app enforces max 3).';
comment on column public.users.pot_visits is
  'Map of pot_id -> last-visited ISO timestamp for home-list ordering.';

-- Atomic visit stamp so concurrent opens don't clobber each other.
create or replace function public.record_pot_visit(p_pot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_visits jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.users
  set pot_visits =
    coalesce(pot_visits, '{}'::jsonb)
    || jsonb_build_object(p_pot_id::text, to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  where id = auth.uid()
  returning pot_visits into next_visits;

  return coalesce(next_visits, '{}'::jsonb);
end;
$$;

revoke all on function public.record_pot_visit(uuid) from public;
grant execute on function public.record_pot_visit(uuid) to authenticated;
