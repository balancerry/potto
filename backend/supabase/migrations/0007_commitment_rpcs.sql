-- Atomic RPCs for Commitments ("Upcoming Payments"). NOT CONNECTED to a live
-- Supabase project (see note in 0001). Mirrors src/store/PottoStore.tsx 1:1
-- so the client-only implementation and these RPCs agree on every validation
-- and can be swapped without changing the calling code's contract — same
-- pattern as approve_join_request in 0003.
--
-- A Postgres function body runs inside a single transaction: if any
-- exception is raised, every write in that function rolls back, so
-- "commitment created but transaction fails" / "transaction created but
-- commitment link fails" (spec section 29 items 24-25) can never leave
-- partial state. `for update` locks guard concurrent payment creation
-- against the same Commitment (spec section 29 item 21) racing past the
-- remaining-amount check.

-- ---------------------------------------------------------------------
-- create_commitment / update_commitment / cancel_commitment
--
-- These three only ever touch the `commitments` table — never
-- `transactions` — which is the whole point of the spec's core accounting
-- rule: creating/editing/cancelling a Commitment must never move money.
-- ---------------------------------------------------------------------

create or replace function create_commitment(
  p_pot_id uuid,
  p_title text,
  p_vendor_name text,
  p_category text,
  p_description text,
  p_total_amount bigint, -- paise
  p_due_date date
)
returns commitments
language plpgsql
security definer
as $$
declare
  v_member pot_members;
  v_commitment commitments;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be greater than zero';
  end if;

  -- canCreateCommitment == canAddExpense: admin or a non-view-only active member.
  select * into v_member
    from pot_members
    where pot_id = p_pot_id and user_id = auth.uid() and status = 'active'
      and (role = 'admin' or access_level = 'member');
  if v_member is null then
    raise exception 'not authorized to create Commitments in this pot';
  end if;

  insert into commitments (pot_id, title, vendor_name, category, description, total_amount, due_date, status, created_by)
  values (p_pot_id, trim(p_title), nullif(trim(coalesce(p_vendor_name, '')), ''), p_category,
          nullif(trim(coalesce(p_description, '')), ''), p_total_amount, p_due_date, 'planned', v_member.id)
  returning * into v_commitment;

  return v_commitment;
end;
$$;

create or replace function update_commitment(
  p_commitment_id uuid,
  p_title text,
  p_vendor_name text,
  p_category text,
  p_description text,
  p_total_amount bigint,
  p_due_date date
)
returns commitments
language plpgsql
security definer
as $$
declare
  v_commitment commitments;
  v_member pot_members;
begin
  select * into v_commitment from commitments where id = p_commitment_id for update;
  if v_commitment is null then
    raise exception 'commitment not found';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be greater than zero';
  end if;

  -- canEditCommitment: admin edits any; a write-access member only their own; view-only never.
  select * into v_member
    from pot_members
    where pot_id = v_commitment.pot_id and user_id = auth.uid() and status = 'active';
  if v_member is null or not (
    v_member.role = 'admin'
    or (v_member.access_level = 'member' and v_commitment.created_by = v_member.id)
  ) then
    raise exception 'not authorized to edit this commitment';
  end if;

  -- Historical transactions are never touched by a total-amount change (spec section 19).
  update commitments
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

create or replace function cancel_commitment(p_commitment_id uuid)
returns commitments
language plpgsql
security definer
as $$
declare
  v_commitment commitments;
  v_member pot_members;
begin
  select * into v_commitment from commitments where id = p_commitment_id for update;
  if v_commitment is null then
    raise exception 'commitment not found';
  end if;

  -- Cancelling is admin-only (spec section 25's permission table).
  select * into v_member
    from pot_members
    where pot_id = v_commitment.pot_id and user_id = auth.uid() and status = 'active' and role = 'admin';
  if v_member is null then
    raise exception 'not authorized to cancel this commitment';
  end if;

  -- Never deletes the commitment or its historical payments/transactions (spec section 20).
  update commitments set status = 'cancelled', updated_at = now() where id = p_commitment_id
    returning * into v_commitment;

  return v_commitment;
end;
$$;

-- ---------------------------------------------------------------------
-- add_commitment_payment / create_commitment_with_payment
--
-- ASSUMES a `transactions` table shaped like src/types/models.ts's
-- Transaction (pot_id, type, description, amount, paid_by, payment_source,
-- category, transaction_date, note, created_by, created_at — see
-- TRIP_WALLET_PRODUCT_SPEC.md section 31) exists by the time this migration
-- is applied for real, per the same assumption 0001 already makes for the
-- rest of the ledger. Adjust the `insert into transactions (...)` column
-- list below to match whatever that migration ends up using; everything
-- else (permission checks, remaining-amount validation, the lock ordering)
-- is correct independent of that table's exact shape.
-- ---------------------------------------------------------------------

create or replace function add_commitment_payment(
  p_commitment_id uuid,
  p_description text,
  p_amount bigint, -- paise
  p_paid_by uuid, -- pot_member id
  p_payment_source text, -- 'pool' | 'personal'
  p_category text,
  p_transaction_date date,
  p_note text
)
returns table (transaction_id uuid, commitment_id uuid)
language plpgsql
security definer
as $$
declare
  v_commitment commitments;
  v_member pot_members;
  v_paid bigint;
  v_remaining bigint;
  v_tx_id uuid;
begin
  select * into v_commitment from commitments where id = p_commitment_id for update;
  if v_commitment is null then
    raise exception 'commitment not found';
  end if;
  if v_commitment.status = 'cancelled' then
    raise exception 'this commitment has been cancelled';
  end if;

  -- canAddCommitmentPayment == canAddExpense: admin or a non-view-only active member.
  select * into v_member
    from pot_members
    where pot_id = v_commitment.pot_id and user_id = auth.uid() and status = 'active'
      and (role = 'admin' or access_level = 'member');
  if v_member is null then
    raise exception 'not authorized to add a payment to this commitment';
  end if;

  -- Paid amount is looked up live against linked transactions' current
  -- amounts, exactly like calculateCommitmentPaid in src/logic/commitments.ts,
  -- so an already-edited/deleted transaction can never be double-counted.
  select coalesce(sum(t.amount), 0) into v_paid
    from commitment_payments cp
    join transactions t on t.id = cp.transaction_id
    where cp.commitment_id = v_commitment.id;
  v_remaining := v_commitment.total_amount - v_paid;

  if p_amount is null or p_amount <= 0 then
    raise exception 'enter an amount greater than zero';
  end if;
  if p_amount > v_remaining then
    raise exception 'payment exceeds remaining commitment amount by %', (p_amount - v_remaining);
  end if;

  insert into transactions (pot_id, type, description, amount, paid_by, payment_source, category, transaction_date, note, created_by)
  values (
    v_commitment.pot_id,
    case when p_payment_source = 'pool' then 'pool_expense' else 'member_expense' end,
    p_description, p_amount, p_paid_by, p_payment_source, p_category, p_transaction_date, p_note, p_paid_by
  )
  returning id into v_tx_id;

  insert into commitment_payments (commitment_id, pot_id, transaction_id, amount)
  values (v_commitment.id, v_commitment.pot_id, v_tx_id, p_amount);

  return query select v_tx_id, v_commitment.id;
end;
$$;

create or replace function create_commitment_with_payment(
  p_pot_id uuid,
  p_title text,
  p_vendor_name text,
  p_category text,
  p_description text,
  p_total_amount bigint,
  p_due_date date,
  p_payment_description text,
  p_payment_amount bigint,
  p_paid_by uuid,
  p_payment_source text,
  p_payment_category text,
  p_transaction_date date,
  p_note text
)
returns table (commitment_id uuid, transaction_id uuid)
language plpgsql
security definer
as $$
declare
  v_member pot_members;
  v_commitment_id uuid;
  v_tx_id uuid;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;
  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'total amount must be greater than zero';
  end if;
  if p_payment_amount is null or p_payment_amount <= 0 then
    raise exception 'enter an amount greater than zero';
  end if;
  if p_payment_amount > p_total_amount then
    raise exception 'payment exceeds remaining commitment amount by %', (p_payment_amount - p_total_amount);
  end if;

  select * into v_member
    from pot_members
    where pot_id = p_pot_id and user_id = auth.uid() and status = 'active'
      and (role = 'admin' or access_level = 'member');
  if v_member is null then
    raise exception 'not authorized to create a commitment with a payment in this pot';
  end if;

  insert into commitments (pot_id, title, vendor_name, category, description, total_amount, due_date, status, created_by)
  values (p_pot_id, trim(p_title), nullif(trim(coalesce(p_vendor_name, '')), ''), p_category,
          nullif(trim(coalesce(p_description, '')), ''), p_total_amount, p_due_date, 'planned', v_member.id)
  returning id into v_commitment_id;

  insert into transactions (pot_id, type, description, amount, paid_by, payment_source, category, transaction_date, note, created_by)
  values (
    p_pot_id,
    case when p_payment_source = 'pool' then 'pool_expense' else 'member_expense' end,
    p_payment_description, p_payment_amount, p_paid_by, p_payment_source, p_payment_category, p_transaction_date, p_note, p_paid_by
  )
  returning id into v_tx_id;

  insert into commitment_payments (commitment_id, pot_id, transaction_id, amount)
  values (v_commitment_id, p_pot_id, v_tx_id, p_payment_amount);

  return query select v_commitment_id, v_tx_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Note on transaction deletion (spec section 27) — no delete_transaction RPC
-- exists yet anywhere in this repo (see the Explore report this migration
-- was written from: only approve/reject_join_request exist today). Once one
-- is added, it must delete the corresponding commitment_payments row(s)
-- (`delete from commitment_payments where transaction_id = p_transaction_id`)
-- inside the same function body, exactly like PottoStore.deleteTransaction
-- does client-side — never leaving an orphaned commitment_payment. If/when
-- commitment_payments.transaction_id gets its real foreign key (see the
-- header note in 0005_commitments.sql), `on delete cascade` on that
-- constraint makes this automatic instead.
-- ---------------------------------------------------------------------
