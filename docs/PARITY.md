# Mobile ↔ Web feature parity

| Mobile Feature | Web Feature | Implemented | Logic matched | DB | Notes |
|----------------|-------------|-------------|---------------|-----|-------|
| Home pot list | `/` | ✓ | ✓ | ✓ | Delete pot available to admin via settings/delete action |
| Create pot | `/pots/new` | ✓ | ✓ | ✓ | RPC `create_pot` |
| Join code / QR | `/join` | ✓ | ✓ | ✓ | Web: type code; camera QR optional later |
| Invite link join | `/invite/[code]` | ✓ | ✓ | ✓ | Path `/invite` (mobile deep link `/join/[code]`) |
| Pot dashboard | `/pots/[id]` | ✓ | ✓ | ✓ | |
| Settings / archive | `/pots/[id]/settings` | ✓ | ✓ | ✓ | Admin |
| Summary / export | `/pots/[id]/summary` | ✓ | ✓ | ✓ | Print HTML (no expo-print) |
| Invite & join codes | `/pots/[id]/invite` | ✓ | ✓ | ✓ | QR via `qrcode.react` |
| Members | `/pots/[id]/members` | ✓ | ✓ | ✓ | Soft-remove |
| Join request review | `/pots/[id]/join-requests/[id]` | ✓ | ✓ | ✓ | RPC approve/reject |
| Add / edit money | `/pots/[id]/add-money` | ✓ | ✓ | ✓ | |
| Add / edit expense | `/pots/[id]/add-expense` | ✓ | ✓ | ✓ | Splits + commitment link |
| Activity | `/pots/[id]/transactions` | ✓ | ✓ | ✓ | Type filters |
| Member contributions | `/pots/[id]/contributions/[memberId]` | ✓ | ✓ | ✓ | |
| Transaction detail | `/pots/[id]/transactions/[txId]` | ✓ | ✓ | ✓ | |
| Settle up | `/pots/[id]/settle` | ✓ | ✓ | ✓ | Two-stage pool funding |
| Edit settlement | `/pots/[id]/edit-settlement` | ✓ | ✓ | ✓ | |
| Balance | `/pots/[id]/balance` | ✓ | ✓ | ✓ | |
| Commitments list | `/pots/[id]/commitments` | ✓ | ✓ | ✓ | |
| Add / edit commitment | `/commitments/new` + detail | ✓ | ✓ | ✓ | |
| Commitment detail / pay / cancel | `/commitments/[id]` | ✓ | ✓ | ✓ | |
| Simulated auth | Magic link | ✓ | n/a | ✓ | **Web improvement** |
| Seed demo data | — | n/a | — | empty DB | Create pots after sign-in |
| QR camera scan | — | ✗ | — | — | Manual code entry; paste QR payload supported if added later |
| PDF share native | Print / browser | Partial | ✓ summary | ✓ | Web uses print |

## Unavoidable differences

1. **Authentication** — mobile MVP had a hardcoded user; web uses Supabase magic link.
2. **Persistence** — mobile in-memory; web is Supabase-backed.
3. **PDF** — mobile uses expo-print/share; web uses printable HTML summary.
4. **Camera QR** — not required for parity of join *capability*; join code entry works.
