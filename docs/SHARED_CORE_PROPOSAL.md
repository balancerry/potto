# Proposal: shared core package

## Problem

Ten logic files plus models, money helpers and payment methods (~3,000 lines) are copied between `mobile/src/logic` and `web/src/lib/core`. They are identical today apart from import paths, but nothing enforces it. Tests exist only on mobile, so a web-side edit is unverified. A recent example: the summary HTML status labels had already diverged.

## Proposal

Create `packages/core` (`@potto/core`) holding:

- `logic/*` (accounting, categories, commitments, invites, join-requests, next-up, permissions, pool-money, pot-summary, pot-summary-html)
- `models.ts`, `money.ts`, `payment-methods.ts`, `auth/validation.ts`
- the existing `*.test.ts` files

Both apps depend on it via npm workspaces. Mobile and web delete their copies and import from `@potto/core`.

## Steps

1. Add root `package.json` with `"workspaces": ["packages/*", "mobile", "web"]` (or use `file:` deps if workspaces conflict with Expo's Metro resolution).
2. Move mobile's `logic/`, `types/models.ts`, `utils/money.ts`, `constants/payment-methods.ts` into `packages/core/src`. Keep mobile's tests with them.
3. Metro: add the package to `watchFolders` and `resolver.nodeModulesPaths`.
4. Next.js: add `transpilePackages: ['@potto/core']` in `next.config.ts`.
5. Replace imports in both apps (`@/logic/x` and `@/lib/core/logic/x` become `@potto/core/logic/x`). Remove the re-export shims `web/src/types/models.ts` and `web/src/utils/money.ts`.
6. Run the core tests in CI for both apps.

## Risks

- Expo/Metro and monorepo symlinks can be fiddly, so spike on a branch first.
- `package-lock.json` and `yarn.lock` currently coexist in `web`; pick one package manager first.
- Not everything should move: `user-pot-prefs.ts` and `recent-pots.ts` mix pure helpers with platform storage. Only the pure parts are candidates, in a later phase.

## Cheaper interim option

A CI script that normalises import paths and diffs the two copies, failing on any difference. About 20 lines of shell and it catches drift immediately.

## Recommendation

Do the interim CI check now, and the package extraction once the lockfile and Metro questions are settled.
