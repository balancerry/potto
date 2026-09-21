-- Allow display-name override when approving a join request (link existing or create new).
-- Add admin RPC to update member role / access / display name.

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
    where pot_id = v_request.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
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
    where pot_id = v_member.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
  if v_reviewer is null then
    raise exception 'not authorized to manage members for this pot';
  end if;

  v_role := coalesce(nullif(trim(p_role), ''), v_member.role);
  v_access := coalesce(nullif(trim(p_access_level), ''), v_member.access_level);
  v_name := coalesce(nullif(trim(p_display_name), ''), v_member.display_name);

  if v_role not in ('admin', 'member') then
    raise exception 'invalid role: %', v_role;
  end if;
  if v_access not in ('member', 'view_only') then
    raise exception 'invalid access level: %', v_access;
  end if;

  -- Admins must keep full member access.
  if v_role = 'admin' then
    v_access := 'member';
  end if;

  -- Prevent removing the last admin.
  if v_member.role = 'admin' and v_role <> 'admin' then
    select count(*) into v_admin_count
      from public.pot_members
      where pot_id = v_member.pot_id and status = 'active' and role = 'admin' and id <> v_member.id;
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

grant execute on function public.update_pot_member(uuid, text, text, text) to authenticated;
