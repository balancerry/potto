# Public pot sharing

A pot owner or admin can switch on a **read-only public link**. Anyone with it can see the pot's names and amounts without an account, without joining, and without Potto creating a user, a membership or a join request for them.

Backend: `backend/supabase/migrations/0019_public_pot_sharing.sql`. Tests: `backend/supabase/tests/pot_public_share.test.sql`.

## Rules

| | |
|---|---|
| Default | **Off** for every pot, including all existing ones. Nothing is public until an owner/admin enables it. |
| Who can turn it on/off | Pot owner or admin (`is_pot_admin`). |
| Who can see/copy the link | Any active member, once it is on. Removed members cannot. |
| Disabling | Takes effect when the transaction commits; the link answers "no longer publicly available". |
| Re-enabling | Always issues a **new** token. A revoked link never works again. |
| Visitors | Read-only. No buttons for contributions, expenses, edit, delete, join or request-to-join, not even disabled ones. |
| Signed-in members | Opening a link for a pot they belong to takes them to the normal app screen. Non-members see the public view and are never added. |

## Data model

`pot_public_share`

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `pot_id` | → `pots` **on delete cascade** (deleting a pot deletes its links) |
| `public_token` | `text`, unique, matches `^[A-Za-z0-9_-]{32,128}$`. Generated as 43 chars of URL-safe base64 from two `gen_random_uuid()` values (~244 bits). Not derived from any id. |
| `is_enabled` | `true` while live |
| `created_by` | → `users`, nullable, `on delete set null` |
| `created_at`, `revoked_at` | `revoked_at` is set exactly when `is_enabled` is false (CHECK) |

Indexes: unique `(public_token)` (every public view looks up by this), unique `(pot_id) where is_enabled` (one live link per pot; revoked rows stay as history), `(pot_id)`.

**RLS:** enabled with **no policies**, and every privilege revoked from `public`, `anon` and `authenticated`. The table is unreachable through the REST API; only the `SECURITY DEFINER` functions below touch it.

## RPCs

| Function | Callable by | What it does |
|----------|-------------|--------------|
| `get_public_pot(p_token)` | `anon`, `authenticated` | Returns `{status:"not_found"}`, `{status:"revoked"}`, or `{status:"ok", …}` with the sanitized snapshot. |
| `get_pot_public_share(p_pot_id)` | `authenticated` | `{enabled, token, shared_at, can_manage}` for the Share sheet. Active members only. |
| `enable_pot_public_share(p_pot_id)` | `authenticated` | Idempotent: returns the live link or creates one. Owner/admin only. Locks the pot row to serialize concurrent calls. |
| `disable_pot_public_share(p_pot_id)` | `authenticated` | Revokes the live link. Idempotent. Owner/admin only. |
| `generate_public_share_token()` | nobody (internal) | Token generator. |

Supabase hands new functions to `anon` by default, so every non-anonymous function is revoked from `anon` explicitly. The test suite checks this.

## What a visitor receives

`get_public_pot` builds its JSON from an allow-list:

- **pot:** name, description, currency, archived flag
- **summary:** member count, contributed, spent, pool balance (contributions − pool expenses, same rule as the apps), transaction count. Totals cover the whole ledger.
- **members:** active members' display name and what each contributed
- **transactions:** newest first, **capped at 500** (`transactions_truncated` says so). Per row: type, description, amount, date, created time, payer / receiver *by name*, category name+icon+color, participants *by name*.
- **viewer_pot_id:** only set when the caller is already an active member of this pot.

Never returned: any id (pot, member, transaction, user, category), emails, phone numbers, avatars, roles/access levels, transaction **notes**, payment methods, pool accounts, **pool transfers** (internal bookkeeping), planned payments / vendor commitments, join and invite codes, join requests, notifications, other pots. The SQL tests assert there is no UUID anywhere in the payload, no sensitive key, and no note/email/code text.

## Security model

- The only anonymous entry point is `get_public_pot`. It validates the token format, then looks up one token; there is no way to steer it to another pot. A pot's own id is not a valid token.
- Every other table keeps its existing RLS. Anonymous callers read zero rows from `pots`, `pot_members`, `transactions`, `users`, … and cannot insert, update or delete (all asserted in the SQL tests).
- A leaked link is revoked by turning sharing off and on again (the token rotates).
- Entropy makes enumeration infeasible; there is **no application-level rate limit**. Supabase's API gateway limits and Vercel's platform limits are the backstop. The 500-row cap bounds the cost of one call.
- Web responses for `/pot/*` are `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, plus matching `<meta>` tags, so revocation is never served stale and links are not indexed or leaked via `Referer`.
- Pre-existing, unrelated to this feature: the `users_select_authenticated` policy lets any *signed-in* user read every `users` row, including email and phone. Anonymous callers are not affected. Worth tightening separately.

## Where it lives in the apps

| | Web | Mobile |
|---|---|---|
| Public viewer | `/pot/[token]` (`app/pot/[token]/`) | `/shared/[token]` (`app/shared/[token].tsx`) |
| Share controls | Header **Share** button (dialog) + card on Pot settings | Pot ⋯ menu → **Share pot**; Pot settings → **Public link** |
| Parsing / selectors | `lib/core/logic/public-pot.ts` | `logic/public-pot.ts` (identical copy, tested) |
| Preview as a visitor | Share panel → Preview (`?preview=1`) | Share screen → Preview as a visitor |

On mobile `/pot/<id>` is already the signed-in pot screen, so a shared link `…/pot/<token>` is rewritten to `/shared/<token>` in `app/+native-intent.tsx`. The rewrite only matches a token-shaped segment and never a UUID, so existing `/pot/<uuid>` links are untouched. `/shared` and `/appearance` are the two routes `AuthBootstrap` lets signed-out users open.

Share text: `Check out our <pot name> pot on Potto:` + the link. Web uses `navigator.share` where available, otherwise WhatsApp (`wa.me`); copy is always available. Mobile uses the system share sheet.

## Deep links (app installed → app, otherwise → web)

Links are `https://<site>/pot/<token>`, so without the app they simply open on the web. To make an installed app claim them, finish this one-time setup (it needs identifiers only you have):

1. In `mobile/app.json` set `ios.bundleIdentifier` and `android.package` (not set yet). `ios.associatedDomains` and `android.intentFilters` for `trypotto.in` / `www.trypotto.in` and path prefix `/pot/` are already added.
2. On the web deployment set:
   - `APPLE_APP_ID` = `<TeamID>.<bundle id>` → serves `/.well-known/apple-app-site-association`
   - `ANDROID_PACKAGE` and `ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated; from Play App Signing or `eas credentials -p android`) → serves `/.well-known/assetlinks.json`
   Until set, those URLs return 404 so the domain is not claimed with made-up ids.
3. Make a new native build. Universal/App Links cannot be tested in Expo Go.

## Testing

```bash
# Database (scratch DB with migrations 0008..0019 + Supabase-style anon/authenticated roles; never a real project)
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f backend/supabase/tests/pot_public_share.test.sql

# Parsing, selectors, URL/token handling, theme parity
cd mobile && npx jest
```

Covered by the SQL test: off by default; owner/admin-only enable and disable (members, view-only, outsiders, removed members and anonymous all refused); idempotent enable; token shape; valid/invalid/garbage/oversized/SQL-ish/case-flipped/pot-id tokens; revoked vs unknown; re-enable rotates; pot isolation; deleted pot; anonymous table reads/writes denied; viewer pot id only for active members; no ids/notes/emails/codes in the payload; 500-row cap with exact totals.

Manual checks worth repeating before release: open a link in a private window; flip sharing off and refresh; open a link signed in as a member, as a non-member, and signed out on the mobile app.

## Known limits

- Only the latest 500 ledger rows are listed (totals are exact).
- Planned payments, pool transfers and notes are intentionally not shown.
- An unknown token renders the "Pot not found" screen but with HTTP 200, because Next streams the loading skeleton before `notFound()` resolves. The page carries `noindex`.
