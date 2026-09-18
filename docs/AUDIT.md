# Potto Mobile Application Audit

**Date:** 2026-09-18  
**Source of truth:** Expo React Native app in this repository (`mobile/src/`)

## Executive summary

Potto (Trip Wallet) is a shared-money ledger for group trips/events. The mobile app is a fully featured **in-memory MVP**: simulated auth (hardcoded user "Raj"), seed data, no persistence, no live Supabase client. Business logic is pure TypeScript under `mobile/src/logic/`. Reference SQL migrations exist under `backend/supabase/migrations/` but were **not connected** to any project until the web build.

## Stack (mobile)

| Layer | Choice |
|-------|--------|
| Framework | Expo ~57, Expo Router, React 19, RN 0.86 |
| State | React Context (`PottoStore`) + `useState` |
| Auth | Simulated `PottoUser` (no login) |
| Persistence | None (seed on boot) |
| Money | Integer **paise** (INR) |
| Deep links | Scheme `potto`; invite URL `https://potto.app/invite/{code}`; in-app `/join/[code]`; QR `POTTO_JOIN:1:{joinCode}` |

## Modules

1. **Pots** — create, list, delete, archive, settings
2. **Members** — roles (`admin`/`member`), access (`member`/`view_only`), soft-remove
3. **Contributions** — add money (multi-member), edit/delete
4. **Expenses** — pool vs personal, equal/custom/percentage splits
5. **Settlements** — two-stage pool funding + member transfers; record/edit
6. **Balances** — derived ledger explanations
7. **Invites** — invite link + separate join code/QR
8. **Join requests** — request → admin approve (link existing / create new) / reject
9. **Commitments** ("Upcoming Payments") — planned obligations + linked expense payments
10. **Summary/PDF** — export pot report (native print/share)

## Roles & permissions

| Capability | Admin | Member (write) | View only |
|------------|-------|----------------|-----------|
| Add money / expense / settle / invite | ✓ | ✓ | ✗ |
| Create commitment / add payment | ✓ | ✓ | ✗ |
| Edit/delete own transactions | ✓ (any) | ✓ own | ✗ |
| Edit own commitments | ✓ (any) | ✓ own | ✗ |
| Cancel commitment | ✓ | ✗ | ✗ |
| Manage members / join requests / pot settings / archive | ✓ | ✗ | ✗ |

Enforcement: `mobile/src/logic/permissions.ts` + store mutations. Web must mirror via **RLS + RPCs**.

## Gaps vs production backend

- No real auth → Magic Link required for web
- No `transactions` table in existing SQL (noted in migrations)
- `users` table not wired to `auth.users`
- Missing pot fields in SQL: `currency`, `expected_contribution_per_member`
- No pots INSERT policy in reference RLS
- Mobile `deletePot` has no permission gate (web: creator/admin only)

## Pure logic to share

| File | Responsibility |
|------|----------------|
| `accounting.ts` | Pool, balances, splits, settlement plans, contribution summaries |
| `commitments.ts` | Paid/remaining/status/due-date |
| `join-requests.ts` | Resolve codes, approve/reject/link |
| `invites.ts` | Code generation, QR payloads |
| `permissions.ts` | Capability checks |
| `pot-summary.ts` | Report view model |

All calculations use integer paise; never floating-point money math.
