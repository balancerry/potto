-- Potto Upcoming Payments & Commitments feature — schema.
--
-- NOT CONNECTED to a live Supabase project (see note in 0001). Mirrors
-- src/logic/commitments.ts and the Commitment/CommitmentPayment actions in
-- src/store/PottoStore.tsx (createCommitment, updateCommitment,
-- cancelCommitment, addCommitmentPayment, createCommitmentWithPayment) so a
-- future move to a real backend is a drop-in. Column/table names follow
-- src/mvp/Potto_Upcoming_Payments_Commitments_Spec.md section 5, adapted to
-- this project's snake_case + pot_id conventions.
--
-- IMPORTANT — this repo's `transactions` ledger (contributions / pool_expense
-- / member_expense / settlement) is not yet defined in SQL anywhere (see the
-- closing note in 0001_invitation_join_requests.sql: "financial tables...
-- already exist in the product and are intentionally not redefined here").
-- The RPCs at the bottom of this file assume a `transactions` table shaped
-- like src/types/models.ts's Transaction (see also
-- TRIP_WALLET_PRODUCT_SPEC.md section 31) will exist by the time this
-- migration is actually applied. commitment_payments.transaction_id is
-- therefore a plain uuid without a physical foreign key for now — add
-- `references transactions(id) on delete cascade` once that table is real.

create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references pots(id) on delete cascade,
  title text not null,
  vendor_name text,
  category text,
  description text,
  total_amount bigint not null check (total_amount > 0), -- paise
  due_date date,
  -- 'cancelled' is the only value ever written directly by a user action
  -- (cancel_commitment below). planned/partially_paid/fully_paid are
  -- re-derived from commitment_payments by the application layer on every
  -- read (deriveCommitmentStatus in src/logic/commitments.ts) and kept here
  -- only so a status filter/index works without joining every payment.
  status text not null default 'planned'
    check (status in ('planned', 'partially_paid', 'fully_paid', 'cancelled')),
  created_by uuid not null references pot_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commitments_pot_id_idx on commitments (pot_id);

create table if not exists commitment_payments (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references commitments(id) on delete cascade,
  -- Denormalized like Transaction.pot_id — lets RLS/queries enforce Pot
  -- isolation (spec section 26/30) without joining through commitments.
  pot_id uuid not null references pots(id) on delete cascade,
  -- The one real, actual money-movement row this payment links to. See the
  -- file header note above re: the transactions table not existing in SQL yet.
  transaction_id uuid not null,
  amount bigint not null check (amount > 0), -- paise, snapshot of the transaction's amount at link time
  created_at timestamptz not null default now(),
  -- A transaction can never be linked to more than one Commitment payment
  -- (spec section 30/29 item 27: "same transaction linked twice").
  unique (transaction_id)
);

create index if not exists commitment_payments_commitment_id_idx on commitment_payments (commitment_id);
create index if not exists commitment_payments_pot_id_idx on commitment_payments (pot_id);
