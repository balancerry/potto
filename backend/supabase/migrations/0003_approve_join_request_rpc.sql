-- Atomic approval RPC. NOT CONNECTED to a live Supabase project (see 0001).
--
-- Mirrors src/logic/join-requests.ts (approveExistingMember / approveNewMember)
-- 1:1 so the client-only implementation and this RPC agree on every validation
-- and can be swapped without changing the calling code's contract.
--
-- A Postgres function body already runs inside a single transaction — if any
-- exception is raised, every write in this function is rolled back, so a
-- failure never partially applies (spec: "Atomic approval" / "If any step
-- fails, nothing should partially update"). The explicit `for update` locks
-- guard against two admins approving the same request concurrently
-- (spec section 20, item 13/25).

create or replace function approve_join_request(
  p_join_request_id uuid,
  p_target_member_id uuid,      -- existing pot_member to link to; null to create a new one
  p_new_member_display_name text, -- required when p_target_member_id is null
  p_access_level text            -- 'member' | 'view_only'
)
returns pot_members
language plpgsql
security definer
as $$
declare
  v_request join_requests;
  v_reviewer pot_members;
  v_member pot_members;
begin
  if p_access_level not in ('member', 'view_only') then
    raise exception 'invalid access level: %', p_access_level;
  end if;

  -- 1. Validate request (locked so a concurrent approval can't race past this point).
  select * into v_request from join_requests where id = p_join_request_id for update;
  if v_request is null then
    raise exception 'join request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'join request is not pending (status=%)', v_request.status;
  end if;

  -- 2. Validate admin permission — the caller must be an active admin of this Pot.
  select * into v_reviewer
    from pot_members
    where pot_id = v_request.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
  if v_reviewer is null then
    raise exception 'not authorized to review join requests for this pot';
  end if;

  if p_target_member_id is not null then
    -- 3. Validate the selected pot_member belongs to the same pot (lock it).
    select * into v_member
      from pot_members
      where id = p_target_member_id and pot_id = v_request.pot_id
      for update;
    if v_member is null then
      raise exception 'selected member does not belong to this pot';
    end if;

    -- 4. Validate member is not already linked to a *different* user.
    -- Re-linking the same user, or a previously-removed member (user_id null), is allowed.
    if v_member.user_id is not null and v_member.user_id <> v_request.user_id then
      raise exception 'selected member is already linked to another account';
    end if;

    -- 5. Link pot_member.user_id — the member's id and its historical
    -- transactions (which reference pot_member_id) never change.
    update pot_members
      set user_id = v_request.user_id, status = 'active', access_level = p_access_level
      where id = v_member.id
      returning * into v_member;
  else
    if p_new_member_display_name is null or length(trim(p_new_member_display_name)) = 0 then
      raise exception 'display name is required to create a new member';
    end if;
    insert into pot_members (pot_id, user_id, display_name, role, access_level, status)
    values (v_request.pot_id, v_request.user_id, trim(p_new_member_display_name), 'member', p_access_level, 'active')
    returning * into v_member;
  end if;

  -- 6/7/8. Set join_request.status = approved, linked_member_id, reviewed_by/at.
  update join_requests
    set status = 'approved',
        linked_member_id = v_member.id,
        reviewed_by = v_reviewer.id,
        reviewed_at = now()
    where id = v_request.id;

  -- 9. commit (implicit — the function returns normally).
  return v_member;
end;
$$;

create or replace function reject_join_request(p_join_request_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_request join_requests;
  v_reviewer pot_members;
begin
  select * into v_request from join_requests where id = p_join_request_id for update;
  if v_request is null then
    raise exception 'join request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'join request is not pending (status=%)', v_request.status;
  end if;

  select * into v_reviewer
    from pot_members
    where pot_id = v_request.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
  if v_reviewer is null then
    raise exception 'not authorized to review join requests for this pot';
  end if;

  update join_requests
    set status = 'rejected', reviewed_by = v_reviewer.id, reviewed_at = now()
    where id = v_request.id;
end;
$$;
