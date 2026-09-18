-- RPCs mirroring mobile store actions for atomic multi-step writes.

-- ---------------------------------------------------------------------------
-- create_pot: pot + admin member + optional placeholder members + starting contribution
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
  v_admin_id uuid;
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

  -- generate codes if not provided
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
  values (v_pot_id, auth.uid(), v_user.name, 'admin', 'member', 'active')
  returning id into v_admin_id;

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
      current_date, v_admin_id, v_admin_id, 'Initial contribution'
    );
  end if;

  return v_pot_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join request approval / rejection (from 0003)
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
begin
  if p_access_level not in ('member', 'view_only') then
    raise exception 'invalid access level: %', p_access_level;
  end if;

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
      set user_id = v_request.user_id, status = 'active', access_level = p_access_level
      where id = v_member.id
      returning * into v_member;
  else
    if p_new_member_display_name is null or length(trim(p_new_member_display_name)) = 0 then
      raise exception 'display name is required to create a new member';
    end if;
    insert into public.pot_members (pot_id, user_id, display_name, role, access_level, status)
    values (v_request.pot_id, v_request.user_id, trim(p_new_member_display_name), 'member', p_access_level, 'active')
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
    where pot_id = v_request.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
  if v_reviewer is null then
    raise exception 'not authorized to review join requests for this pot';
  end if;

  update public.join_requests
    set status = 'rejected', reviewed_by = v_reviewer.id, reviewed_at = now()
    where id = v_request.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Commitment RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_commitment(
  p_pot_id uuid,
  p_title text,
  p_vendor_name text,
  p_category text,
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
      and (role = 'admin' or access_level = 'member');
  if v_member is null then
    raise exception 'not authorized to create Commitments in this pot';
  end if;

  insert into public.commitments (
    pot_id, title, vendor_name, category, description, total_amount, due_date, status, created_by
  ) values (
    p_pot_id, trim(p_title),
    nullif(trim(coalesce(p_vendor_name, '')), ''),
    p_category,
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
  p_category text,
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
    v_member.role = 'admin'
    or (v_member.access_level = 'member' and v_commitment.created_by = v_member.id)
  ) then
    raise exception 'not authorized to edit this commitment';
  end if;

  update public.commitments
    set title = trim(p_title),
        vendor_name = nullif(trim(coalesce(p_vendor_name, '')), ''),
        category = p_category,
        description = nullif(trim(coalesce(p_description, '')), ''),
        total_amount = p_total_amount,
        due_date = p_due_date,
        updated_at = now()
    where id = p_commitment_id
    returning * into v_commitment;

  return v_commitment;
end;
$$;

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
    where pot_id = v_commitment.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
  if v_member is null then
    raise exception 'not authorized to cancel this commitment';
  end if;

  update public.commitments set status = 'cancelled', updated_at = now()
    where id = p_commitment_id
    returning * into v_commitment;

  return v_commitment;
end;
$$;

grant execute on function public.create_pot(text, text, text[], bigint, bigint, text, text) to authenticated;
grant execute on function public.approve_join_request(uuid, uuid, text, text) to authenticated;
grant execute on function public.reject_join_request(uuid) to authenticated;
grant execute on function public.create_commitment(uuid, text, text, text, text, bigint, date) to authenticated;
grant execute on function public.update_commitment(uuid, text, text, text, text, bigint, date) to authenticated;
grant execute on function public.cancel_commitment(uuid) to authenticated;
