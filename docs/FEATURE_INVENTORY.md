# Feature Inventory

Complete feature list derived from `src/app/` and `PottoStore`. Every row must reach parity in the web app.

| Feature | Screens | Roles | Actions | Data R/W | Business rules | Empty / error |
|---------|---------|-------|---------|----------|----------------|---------------|
| Home / pot list | `/` | Any auth user | Open, delete, create, join | Read pots; delete pot | List pots where user is active member | EmptyState: no pots |
| Create pot | `/create-pot` | Auth | Name, desc, members, starting contrib, expected | Create pot + admin member + optional contribution | Creator = admin; currency INR | Name required |
| Join via code/QR | `/join-pot`, `/join-pot/[potId]` | Auth | Enter/scan code, request join | Resolve join_code; create join_request | Invalid/disabled/archived; already member/pending | Error banners |
| Join via invite | `/join/[code]` | Auth | Same as JoinPotFlow | Resolve invite_code | Same | Same |
| Pot dashboard | `/pot/[id]` | Member | Quick actions, activity | Read pot, txs, commitments, join reqs | Hide write CTAs for view_only | Not found |
| Settings | `/pot/[id]/settings` | Admin | Edit name/desc/expected; archive | Update pot | Admin only | Admins-only empty |
| Summary | `/pot/[id]/summary` | Member | View / export PDF | Read | Derived from ledger | Not found |
| Invite | `/pot/[id]/invite` | Write: share; Admin: toggle/regen | Copy/share link & code, QR | Update invite/join flags & codes | Separate invite vs join identities | Disabled banners |
| Members | `/pot/[id]/members` | All read; Admin manage | Remove, review requests | Soft-remove member | Never delete financial identity | — |
| Join request review | `/pot/[id]/join-requests/[id]` | Admin | Approve existing/new + access; reject | Approve/reject RPC | Atomic; no double-link | Already handled |
| Add money | `/pot/[id]/add-money` | Write | Multi contribution / edit | Insert/update contribution txs | canAddMoney / canEditTransaction | Not permitted |
| Add expense | `/pot/[id]/add-expense` | Write | Expense + optional commitment link | Insert/update expense; commitment payment | Splits must sum; pool vs personal | Validation errors |
| Activity | `/pot/[id]/transactions` | Member | Filter by type; contributions tab | Read | sort recent-first | Empty filter |
| Member contributions | `/pot/[id]/contributions/[memberId]` | Member | Open txs | Read | By member id | No contributions |
| Transaction detail | `/pot/[id]/transaction/[txId]` | Member | Edit/delete | Delete (+ cascade commitment links) | Ownership/admin | Not found |
| Settle up | `/pot/[id]/settle` | Write for actions | Pool fund CTA; record payment | recordSettlement | Two-stage funding plan | All settled |
| Edit settlement | `/pot/[id]/edit-settlement` | Write own/admin | Update parties/amount | updateSettlement | Parties ≠ self; amount > 0 | Not permitted |
| Balance | `/pot/[id]/balance` | Member | View explanation | Derived | explainBalance | Not available |
| Commitments list | `/pot/[id]/commitments` | Member | Add / open | Read | Remaining ≠ Total Spent | Empty |
| Add/edit commitment | `/pot/[id]/add-commitment` | Write | CRUD fields | create/update commitment | Never moves money | Not permitted |
| Commitment detail | `/pot/[id]/commitment/[id]` | Member | Cancel (admin), add payment, edit | cancel; link expense | Paid from live tx amounts | Not found |
| Auth (web new) | `/login`, `/auth/callback` | Public | Magic link | Session | Supabase Auth | Expired link |
| Logout | Shell | Auth | Sign out | Session clear | — | — |

## Navigation map (web URLs)

| Mobile | Web |
|--------|-----|
| `/` | `/` |
| `/create-pot` | `/pots/new` |
| `/join-pot` | `/join` |
| `/join-pot/[potId]` | `/join/pot/[potId]` |
| `/join/[code]` | `/invite/[code]` |
| `/pot/[id]/*` | `/pots/[id]/*` |

## Web-specific UX (same rules)

- Desktop sidebar navigation inside a pot
- Tables for transactions/members on large screens; cards on small
- URL query filters for activity type
- Magic-link auth (mobile had simulated identity)
