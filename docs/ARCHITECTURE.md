# Architecture

## Dual clients, one backend

```
React Native (Expo)          Next.js Web
        \                      /
         \                    /
          v                  v
              Supabase
     Auth · Postgres · RLS · RPCs
```

Both clients share the same data model and permission rules. Mobile currently still runs an in-memory `PottoStore` for local demo; the web app is fully wired to Supabase. Mobile can adopt the same API when ready.

## Repo layout

| Path | Role |
|------|------|
| `mobile/` | Expo React Native client |
| `web/` | Next.js client |
| `backend/supabase/` | Postgres schema, RLS, RPCs |

## Web app (`web/`)

| Layer | Responsibility |
|-------|----------------|
| App Router pages | URL addressable screens, server data fetch |
| Server actions | Validated mutations → Supabase |
| RLS / RPCs | Authorization + atomic multi-step writes |
| `lib/core/logic` | Pure accounting / commitments / invites (same rules as mobile) |
| Middleware | Session refresh + redirect unauthenticated users |

## Auth

- Magic link via `supabase.auth.signInWithOtp`
- Callback: `/auth/callback` exchanges `code` for session cookies (`@supabase/ssr`)
- Profile row in `public.users` created by trigger `handle_new_user` on `auth.users` insert

## Roles

Per **pot** (not global):

- **Admin** — settings, archive, members, join reviews, cancel commitments, edit any tx
- **Member (write)** — money, expenses, settle, invite share, own txs/commitments
- **View only** — read ledger; no writes

## Money

All amounts are integer **paise**. UI accepts rupees and converts with `toPaise`. Balances are derived from the transaction ledger — never stored.

## Key RPCs

| RPC | Purpose |
|-----|---------|
| `create_pot` | Pot + admin member + optional members/contribution |
| `approve_join_request` / `reject_join_request` | Atomic admin review |
| `create_commitment` / `update_commitment` / `cancel_commitment` | Upcoming payments (no money movement) |
| `resolve_invite_code` / `resolve_join_code` | Safe public pot summary for join flows |

Expense + commitment payment linking is done in server actions (tx + splits + `commitment_payments`) so FK cascade stays consistent.
