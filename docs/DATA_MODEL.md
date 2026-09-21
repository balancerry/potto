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
| role | text | `admin` \| `member` |
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
| category | text | |
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
| vendor_name, category, description | text | |
| total_amount | bigint > 0 | Paise; never affects pool |
| due_date | date | |
| status | text | planned/partially_paid/fully_paid/cancelled |
| created_by | uuid → pot_members | |
| created_at, updated_at | timestamptz | |

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
