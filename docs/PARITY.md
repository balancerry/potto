# Mobile ↔ Web feature parity

Both apps are Supabase-backed and call the same RPCs and tables. Domain logic is duplicated (see [SHARED_CORE_PROPOSAL.md](SHARED_CORE_PROPOSAL.md)).

Last reviewed: 2026-10-02.

| Feature | Mobile | Web | Notes |
|---------|--------|-----|-------|
| Sign in / sign up (password) | `(auth)/login`, `signup` | `/login` | Both check `email_registered` before sign-up |
| Magic link | AuthContext | `/login` | |
| Forgot / reset / set password | `(auth)/*` | `/auth/reset-password`, `/auth/set-password` | |
| Complete signup | `(auth)/complete-signup` | `/auth/complete-signup` | |
| Home pot list | `/` | `/` | Pins and recently visited synced via `user_pot_prefs` + `record_pot_visit` |
| Create pot | `/create-pot` | `/pots/new` | RPC `create_pot`; same field limits (80 / 240 / 60) |
| Join by code | `/join-pot` | `/join` | Mobile can scan a QR; web is manual entry |
| Join by invite link | `/join/[code]` | `/invite/[code]` | |
| Join request review | `pot/[id]/join-requests/[requestId]` | `/pots/[id]/join-requests/[requestId]` | `approve_join_request` / `reject_join_request` |
| Pot dashboard | `pot/[id]` | `/pots/[id]` | Same `next-up` priority |
| Add money | `add-money` | `add-money` | |
| Add / edit expense | `add-expense` | `add-expense` | Splits, commitment link, create-commitment-with-payment |
| Activity | `transactions` | `transactions` | |
| Transaction detail | `transaction/[txId]` | `transactions/[txId]` | |
| Member contributions | `contributions/[memberId]` | `contributions/[memberId]` | |
| Settle up | `settle` | `settle` | Two-stage pool funding |
| Edit settlement | `edit-settlement` | `edit-settlement` | |
| Balance | `balance` | `balance` | |
| Pool management | `pool`, `transfer`, `reconcile` | `pool`, `pool/transfer`, `pool/reconcile` | `create_pool_transfer`, `assign_pool_manager` |
| Categories | `categories` | `settings/categories` | Create / edit / reorder / activate RPCs |
| Commitments | `commitments`, `add-commitment`, `commitment/[id]` | `commitments`, `commitments/new`, `commitments/[id]` | |
| Members | `members` | `members` | Soft-remove, roles, access level |
| Invite & join codes | `invite` | `invite` | QR rendered on both |
| Settings / archive | `settings` | `settings` | |
| Delete pot | Home screen | Settings (`canDelete`) | Same RPC `delete_pot`, different entry point |
| Summary / export | `summary` | `summary` | expo-print vs browser print; same HTML generator |
| Notifications | `/notifications` + realtime | Bell + realtime | |
| Public read-only pot link (viewer) | `shared/[token]` (rewritten from `…/pot/<token>`) | `/pot/[token]` | Anonymous; RPC `get_public_pot`. See [PUBLIC_SHARING.md](PUBLIC_SHARING.md) |
| Public link controls | Pot ⋯ → Share pot, Settings → Public link (`pot/[id]/share`) | Header **Share** dialog + card on Settings | Owner/admin toggle; members can copy |
| Theme (Light / Dark / System) | `/appearance` (home top bar): Light, Dark or System | Header icon next to the bell: one-click light/dark | Same tokens; see [THEME.md](THEME.md). Web has no way back to System once toggled |

## Intentional differences

1. **QR scanning** — mobile only (`QRScanner`). Web uses manual code entry.
2. **Summary export** — mobile shares a PDF via expo-print; web opens printable HTML.
3. **Help / FAQ** — web only (`/help`).
4. **Realtime scope** — web subscribes per pot (`pot-realtime`); mobile subscribes to the whole workspace.
5. **Delete pot entry point** — see table.
6. **Share via** — web falls back to WhatsApp when the browser has no share sheet; mobile always uses the system share sheet.
7. **Theme storage** — web `localStorage` (`potto-theme`), mobile AsyncStorage (`potto.theme`).
8. **Public link route** — web serves `/pot/<token>` directly; mobile rewrites it to `/shared/<token>` because `/pot/<id>` is already the signed-in pot screen.

## Known gaps

- Web has no automated tests; mobile has 11 test files covering the shared logic.
- Logic files are copied, not shared; they can drift. A byte-for-byte check shows them identical apart from import paths as of the review date.
