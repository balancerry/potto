-- Pot owner role: creator is owner; only owner may permanently delete a pot.
-- Owners keep all admin capabilities via is_pot_admin / is_pot_write_member.

-- ---------------------------------------------------------------------------
-- Widen role check
-- ---------------------------------------------------------------------------
alter table public.pot_members drop constraint if exists pot_members_role_check;

alter table public.pot_members
  add constraint pot_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- ---------------------------------------------------------------------------
-- Backfill: creator membership → owner (else earliest active admin)
-- ---------------------------------------------------------------------------
update public.pot_members pm
set role = 'owner'
from public.pots p
where pm.pot_id = p.id
  and pm.user_id = p.created_by
  and pm.status = 'active'
  and pm.role = 'admin';

-- Pots whose creator row is missing: promote earliest active admin.
update public.pot_members pm
set role = 'owner'
where pm.id in (
  select distinct on (pm2.pot_id) pm2.id
  from public.pot_members pm2
  where pm2.status = 'active'
    and pm2.role = 'admin'
    and not exists (
      select 1 from public.pot_members o
      where o.pot_id = pm2.pot_id and o.role = 'owner' and o.status = 'active'
    )
  order by pm2.pot_id, pm2.created_at asc nulls last, pm2.id asc
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
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
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_pot_owner(target_pot_id uuid)
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
      and role = 'owner'
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
      and (role in ('owner', 'admin') or access_level = 'member')
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: delete owner-only; bootstrap creator as owner
-- ---------------------------------------------------------------------------
drop policy if exists pots_delete_admin on public.pots;
create policy pots_delete_owner on public.pots
  for delete to authenticated
  using (is_pot_owner(id));

drop policy if exists pot_members_insert on public.pot_members;
create policy pot_members_insert on public.pot_members
  for insert to authenticated
  with check (
    is_pot_admin(pot_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and exists (select 1 from public.pots p where p.id = pot_id and p.created_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- create_pot: creator is owner
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

  if p_member_names is not null then
    foreach v_name in array p_member_names loop
      if length(trim(v_name)) > 0 then
        insert into public.pot_members (pot_id, user_id, display_name, role, access_level, status)
        values (v_pot_id, null, trim(v_name), 'member', 'member', 'active');
      end if;
    end loop;
  end if;

  if p_starting_contribution is not null and p_starting_contribution > 0 then
    insert into public.transactions (
      pot_id, type, description, amount, date, paid_by, created_by, note
    ) values (
      v_pot_id, 'contribution', 'Trip contribution', p_starting_contribution,
      current_date, v_owner_id, v_owner_id, 'Initial contribution'
    );
  end if;

  return v_pot_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_pot: owner only
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

  update public.join_requests
  set linked_member_id = null, reviewed_by = null
  where pot_id = p_pot_id;

  delete from public.join_requests where pot_id = p_pot_id;
  delete from public.pot_members where pot_id = p_pot_id;
  delete from public.pots where id = p_pot_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_pot_member: owners/admins manage; cannot assign or demote owner
-- ---------------------------------------------------------------------------
create or replace function public.update_pot_member(
  p_member_id uuid,
  p_role text default null,
  p_access_level text default null,
  p_display_name text default null
)
returns public.pot_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.pot_members;
  v_reviewer public.pot_members;
  v_admin_count int;
  v_role text;
  v_access text;
  v_name text;
begin
  select * into v_member from public.pot_members where id = p_member_id for update;
  if v_member is null then raise exception 'member not found'; end if;
  if v_member.status <> 'active' then raise exception 'member is not active'; end if;

  select * into v_reviewer
    from public.pot_members
    where pot_id = v_member.pot_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin');
  if v_reviewer is null then
    raise exception 'not authorized to manage members for this pot';
  end if;

  v_role := coalesce(nullif(trim(p_role), ''), v_member.role);
  v_access := coalesce(nullif(trim(p_access_level), ''), v_member.access_level);
  v_name := coalesce(nullif(trim(p_display_name), ''), v_member.display_name);

  if v_member.role = 'owner' and v_role <> 'owner' then
    raise exception 'cannot change the pot owner role';
  end if;

  if v_role = 'owner' and v_member.role <> 'owner' then
    raise exception 'cannot assign owner role';
  end if;

  if v_role not in ('owner', 'admin', 'member') then
    raise exception 'invalid role: %', v_role;
  end if;
  if v_access not in ('member', 'view_only') then
    raise exception 'invalid access level: %', v_access;
  end if;

  -- Owner and admin always keep full member access.
  if v_role in ('owner', 'admin') then
    v_access := 'member';
  end if;

  -- Prevent removing the last admin-capable member (owner or admin).
  if v_member.role in ('owner', 'admin') and v_role = 'member' then
    select count(*) into v_admin_count
      from public.pot_members
      where pot_id = v_member.pot_id
        and status = 'active'
        and role in ('owner', 'admin')
        and id <> v_member.id;
    if v_admin_count < 1 then
      raise exception 'cannot demote the last admin';
    end if;
  end if;

  update public.pot_members
    set role = v_role,
        access_level = v_access,
        display_name = v_name
    where id = v_member.id
    returning * into v_member;

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join request review: owner or admin
-- ---------------------------------------------------------------------------
create or replace function public.approve_join_request(
  p_join_request_id uuid,
  p_target_member_id uuid,
  p_new_member_display_name text,
  p_access_level text
)
returns public.pot_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.join_requests;
  v_reviewer public.pot_members;
  v_member public.pot_members;
  v_name text;
begin
  if p_access_level not in ('member', 'view_only') then
    raise exception 'invalid access level: %', p_access_level;
  end if;

  v_name := nullif(trim(coalesce(p_new_member_display_name, '')), '');

  select * into v_request from public.join_requests where id = p_join_request_id for update;
  if v_request is null then raise exception 'join request not found'; end if;
  if v_request.status <> 'pending' then
    raise exception 'join request is not pending (status=%)', v_request.status;
  end if;

  select * into v_reviewer
    from public.pot_members
    where pot_id = v_request.pot_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin');
  if v_reviewer is null then
    raise exception 'not authorized to review join requests for this pot';
  end if;

  if p_target_member_id is not null then
    select * into v_member
      from public.pot_members
      where id = p_target_member_id and pot_id = v_request.pot_id
      for update;
    if v_member is null then
      raise exception 'selected member does not belong to this pot';
    end if;
    if v_member.user_id is not null and v_member.user_id <> v_request.user_id then
      raise exception 'selected member is already linked to another account';
    end if;
    update public.pot_members
      set user_id = v_request.user_id,
          status = 'active',
          access_level = p_access_level,
          display_name = coalesce(v_name, display_name)
      where id = v_member.id
      returning * into v_member;
  else
    if v_name is null then
      raise exception 'display name is required to create a new member';
    end if;
    insert into public.pot_members (pot_id, user_id, display_name, role, access_level, status)
    values (v_request.pot_id, v_request.user_id, v_name, 'member', p_access_level, 'active')
    returning * into v_member;
  end if;

  update public.join_requests
    set status = 'approved',
        linked_member_id = v_member.id,
        reviewed_by = v_reviewer.id,
        reviewed_at = now()
    where id = v_request.id;

  return v_member;
end;
$$;

create or replace function public.reject_join_request(p_join_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.join_requests;
  v_reviewer public.pot_members;
begin
  select * into v_request from public.join_requests where id = p_join_request_id for update;
  if v_request is null then raise exception 'join request not found'; end if;
  if v_request.status <> 'pending' then
    raise exception 'join request is not pending (status=%)', v_request.status;
  end if;

  select * into v_reviewer
    from public.pot_members
    where pot_id = v_request.pot_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin');
  if v_reviewer is null then
    raise exception 'not authorized to review join requests for this pot';
  end if;

  update public.join_requests
    set status = 'rejected', reviewed_by = v_reviewer.id, reviewed_at = now()
    where id = v_request.id;
end;
$$;

-- Commitment RPCs: treat owner like admin
create or replace function public.cancel_commitment(p_commitment_id uuid)
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

  select * into v_member
    from public.pot_members
    where pot_id = v_commitment.pot_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin');
  if v_member is null then
    raise exception 'not authorized to cancel this commitment';
  end if;

  update public.commitments set status = 'cancelled', updated_at = now()
    where id = p_commitment_id
    returning * into v_commitment;

  return v_commitment;
end;
$$;

-- Join-request notifications: include owners with admins
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
        and m.role in ('owner', 'admin')
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
