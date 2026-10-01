# Data Model Inventory

Normalized PostgreSQL model for shared mobile + web backend.

## Entities

### `users` (profile)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = `auth.users.id` |
| name | text NOT NULL | Display name |
| email | text UNIQUE | From auth |
| phone | text UNIQUE nullable | |
| avatar | text nullable | |
| pinned_pot_ids | jsonb NOT NULL default `[]` | Ordered pot ids pinned on home (max 3 in app) |
| pot_visits | jsonb NOT NULL default `{}` | Map of pot_id → last-visited ISO timestamp |
| created_at | timestamptz | |

**Relationships:** 1 user → many pot_members; 1 user → many join_requests

### `pots`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| description | text | |
| currency | text NOT NULL default 'INR' | |
| created_by | uuid NOT NULL → users | Auth user who created |
| invite_code | text UNIQUE NOT NULL | Invite-link identity |
| invite_enabled | boolean default true | |
| join_code | text UNIQUE NOT NULL | Separate join-code identity |
| join_enabled | boolean default true | |
| expected_contribution_per_member | bigint nullable | Paise; informational only |
| status | text | `active` \| `archived` |
| created_at | timestamptz | |

### `pot_members`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Financial identity (never hard-deleted) |
| pot_id | uuid → pots CASCADE | |
| user_id | uuid → users nullable | Linked account |
| display_name | text NOT NULL | |
| role | text | `owner` \| `admin` \| `member` (only owner may delete the pot) |
| access_level | text | `member` \| `view_only` |
| status | text | `active` \| `inactive` |
| created_at | timestamptz | |

**Constraints:** UNIQUE (pot_id, user_id) WHERE user_id IS NOT NULL

### `join_requests`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| pot_id | uuid → pots | |
| user_id | uuid → users | Requester |
| requested_name | text | |
| status | text | pending/approved/rejected/cancelled |
| linked_member_id | uuid → pot_members | |
| reviewed_by | uuid → pot_members | |
| reviewed_at | timestamptz | |
| created_at | timestamptz | |

**Constraints:** UNIQUE (pot_id, user_id) WHERE status = 'pending'

### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| pot_id | uuid → pots | |
| type | text | contribution \| pool_expense \| member_expense \| settlement |
| description | text | |
| amount | bigint | Paise > 0 |
| date | date | Transaction date |
| note | text | |
| category | text | **Deprecated** legacy free text, kept for rollback. Use `category_id`. |
| category_id | uuid → pot_categories | Expenses only; null = Uncategorized. Same-pot enforced by composite FK `(category_id, pot_id)`. |
| paid_by | uuid → pot_members | Contributor / payer / settlement from |
| to_member | uuid → pot_members | Settlement to |
| payment_method | text | cash/upi/bank_transfer/other |
| payment_source | text | pool/personal |
| split_method | text | equal/custom/percentage |
| participants | uuid[] | Member ids |
| created_by | uuid → pot_members | |
| created_at | timestamptz | |

### `transaction_splits`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| transaction_id | uuid → transactions CASCADE | |
| member_id | uuid → pot_members | |
| amount | bigint | Paise ≥ 0 |
| UNIQUE(transaction_id, member_id) | | |

### `commitments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| pot_id | uuid → pots | |
| title | text NOT NULL | |
| vendor_name, description | text | |
| category | text | **Deprecated** legacy free text. Use `category_id`. |
| category_id | uuid → pot_categories | Optional; same-pot enforced like transactions. |
| total_amount | bigint > 0 | Paise; never affects pool |
| due_date | date | |
| status | text | planned/partially_paid/fully_paid/cancelled |
| created_by | uuid → pot_members | |
| created_at, updated_at | timestamptz | |

### `pot_categories`
Pot-specific expense categories (migration `0018_pot_categories.sql`). Expenses and upcoming payments reference a category by `id`, so renaming one re-labels history. Categories are classification only — they never affect amounts, payers, splits, balances or settlements.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| pot_id | uuid → pots CASCADE | UNIQUE (id, pot_id) so other tables can prove same-pot with a composite FK |
| name | text | 1–40 chars; unique per pot, case-insensitive (archived names stay reserved) |
| icon | text | Lucide id from a controlled catalog (CHECK) — never SVG |
| color | text | Palette key from a controlled catalog (CHECK) — never a hex value |
| is_active | boolean | `false` = archived: not selectable for new expenses, still shown on history |
| is_default | boolean | Created from the default set |
| sort_order | int | Per-pot display order, shared by web and mobile |
| created_at, updated_at | timestamptz | |

- **Defaults** (trigger on `pots` insert): Food, Transport, Accommodation, Activities, Shopping, Fuel, Tickets, Other.
- **Limit:** at most `max_active_pot_categories()` (30) active per pot, enforced in the RPCs.
- **Integrity:** composite FKs reject a category from another pot; a used category cannot be hard-deleted; triggers reject archived categories on *new selections* (an edit that leaves an old archived category in place is allowed) and reject categories on non-expense rows.
- **RLS:** members of the pot can `select`. There are no write policies — all writes go through `create_pot_category`, `update_pot_category`, `set_pot_category_active` and `reorder_pot_categories`, which require pot owner/admin (pool manager and regular/view-only members cannot manage categories).
- **Migration of old data:** legacy text was mapped case-insensitively onto the defaults (`Stay`→Accommodation, `Miscellaneous`→Other, …); any other value a pot used (e.g. Groceries, Drinks, free text) became a custom category in that pot. Blank values stay `null` (Uncategorized).
- **Future AI categorization:** suggest a `category_id` from the pot's active categories; never create names on the fly.

### `commitment_payments`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| commitment_id | uuid → commitments | |
| pot_id | uuid → pots | Denormalized |
| transaction_id | uuid → transactions UNIQUE | Real money movement |
| amount | bigint | Snapshot at link time |
| created_at | timestamptz | |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid → users CASCADE | Recipient |
| pot_id | uuid → pots CASCADE nullable | Related pot |
| type | text | `join_request_pending` \| `join_request_approved` \| `join_request_rejected` \| `transaction_created` |
| title | text NOT NULL | |
| body | text NOT NULL | |
| data | jsonb | Deep-link payload (`join_request_id`, `transaction_id`, …) |
| read_at | timestamptz nullable | Null = unread |
| created_at | timestamptz | |

**Created by triggers** on `join_requests` / `transactions`. Clients subscribe via Supabase Realtime. RPCs: `mark_notification_read`, `mark_all_notifications_read`.

## Derived (not stored)

- Pool balance, total spent, member balances, settlement suggestions
- Commitment paid/remaining/display status (except cancelled)
- Contribution expectation status
- MyPosition / pool funding plan

## ER diagram

```
users ──┬── pot_members ──┬── transactions ── transaction_splits
        │                 │         │
        │                 │         └── commitment_payments ── commitments
        ├── join_requests ┘
        └── notifications
              pots ──────────┘
```
