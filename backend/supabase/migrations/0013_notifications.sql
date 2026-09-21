-- In-app notifications for join requests and pot ledger activity.
-- Populated by triggers; clients subscribe via Supabase Realtime.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pot_id uuid references public.pots(id) on delete cascade,
  type text not null check (type in (
    'join_request_pending',
    'join_request_approved',
    'join_request_rejected',
    'transaction_created'
  )),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.format_paise(p_paise bigint)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_paise % 100 = 0 then '₹' || to_char(p_paise / 100, 'FM999G999G999')
    else '₹' || to_char(p_paise / 100.0, 'FM999G999G999D00')
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
    else 'updated the pot'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: join_requests
-- ---------------------------------------------------------------------------
create or replace function public.notify_join_request_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pot_name text;
  v_admin record;
begin
  select name into v_pot_name from public.pots where id = new.pot_id;

  if tg_op = 'INSERT' and new.status = 'pending' then
    for v_admin in
      select m.user_id
      from public.pot_members m
      where m.pot_id = new.pot_id
        and m.status = 'active'
        and m.role = 'admin'
        and m.user_id is not null
        and m.user_id <> new.user_id
    loop
      insert into public.notifications (user_id, pot_id, type, title, body, data)
      values (
        v_admin.user_id,
        new.pot_id,
        'join_request_pending',
        'New join request',
        coalesce(new.requested_name, 'Someone') || ' wants to join ' || coalesce(v_pot_name, 'your pot'),
        jsonb_build_object(
          'join_request_id', new.id,
          'requested_name', new.requested_name,
          'pot_name', v_pot_name
        )
      );
    end loop;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status in ('approved', 'rejected')
  then
    insert into public.notifications (user_id, pot_id, type, title, body, data)
    values (
      new.user_id,
      new.pot_id,
      case when new.status = 'approved' then 'join_request_approved' else 'join_request_rejected' end,
      case when new.status = 'approved' then 'Join request approved' else 'Join request declined' end,
      case
        when new.status = 'approved' then 'You are now a member of ' || coalesce(v_pot_name, 'the pot')
        else 'Your request to join ' || coalesce(v_pot_name, 'the pot') || ' was declined'
      end,
      jsonb_build_object(
        'join_request_id', new.id,
        'status', new.status,
        'pot_name', v_pot_name
      )
    );
  end if;

  return new;
end;
$$;

create trigger join_requests_notify
  after insert or update of status on public.join_requests
  for each row execute function public.notify_join_request_event();

-- ---------------------------------------------------------------------------
-- Triggers: transactions
-- ---------------------------------------------------------------------------
create or replace function public.notify_transaction_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pot_name text;
  v_actor_name text;
  v_actor_user_id uuid;
  v_member record;
  v_title text;
  v_body text;
begin
  select name into v_pot_name from public.pots where id = new.pot_id;

  select m.display_name, m.user_id
    into v_actor_name, v_actor_user_id
  from public.pot_members m
  where m.id = new.created_by;

  v_title := coalesce(v_pot_name, 'Pot') || ' updated';
  v_body :=
    coalesce(v_actor_name, 'Someone')
    || ' '
    || public.transaction_type_label(new.type)
    || ' · '
    || public.format_paise(new.amount);

  for v_member in
    select m.user_id
    from public.pot_members m
    where m.pot_id = new.pot_id
      and m.status = 'active'
      and m.user_id is not null
      and (v_actor_user_id is null or m.user_id <> v_actor_user_id)
  loop
    insert into public.notifications (user_id, pot_id, type, title, body, data)
    values (
      v_member.user_id,
      new.pot_id,
      'transaction_created',
      v_title,
      v_body,
      jsonb_build_object(
        'transaction_id', new.id,
        'transaction_type', new.type,
        'amount', new.amount,
        'description', new.description,
        'actor_name', v_actor_name,
        'pot_name', v_pot_name
      )
    );
  end loop;

  return new;
end;
$$;

create trigger transactions_notify
  after insert on public.transactions
  for each row execute function public.notify_transaction_created();

-- ---------------------------------------------------------------------------
-- Mark read RPCs
-- ---------------------------------------------------------------------------
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke all on function public.format_paise(bigint) from public;
revoke all on function public.transaction_type_label(text) from public;
revoke all on function public.notify_join_request_event() from public;
revoke all on function public.notify_transaction_created() from public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end;
$$;
