# Theme: Light / Dark / System

Both apps offer **Light**, **Dark** and **System** (follow the device). The choice persists across restarts, refreshes, navigation and sign-out. Light is unchanged from before; Dark is the same brand in a warm, low-glare palette (no pure black).

## Tokens

Colors are semantic tokens, never hex values in components. Web exposes them as CSS variables (`web/src/app/globals.css`, used as Tailwind colors such as `bg-surface`, `text-ink-soft`); mobile as `PottoPalette` / `usePottoColors()` (`mobile/src/constants/potto-theme.ts`). The names are the existing ones; the right-hand column maps them to generic design-system names.

| Token (web var / mobile key) | Role | Generic name | Light | Dark |
|---|---|---|---|---|
| `--paper` / `paper` | page background | background | `#F5F0E4` | `#17160F` |
| `--surface` / `surface` | cards, inputs, sheets | surface | `#FFFDF7` | `#211F17` |
| `--surface-sunk` / `surfaceSunk` | wells, stat tiles | surfaceSecondary | `#EFE9D9` | `#191811` |
| `--ink` / `ink` | primary text | textPrimary | `#23211D` | `#F2EFE6` |
| `--ink-soft` / `inkSoft` | secondary text, icons | textSecondary, icon | `#655F52` | `#A9A398` |
| `--line` / `line` | borders, dividers | border | `#E2D8BE` | `#332F23` |
| `--accent` / `accent` | brand, primary actions | primary | `#1E3A2B` | `#5CA98E` |
| `--accent-soft` / `accentSoft` | tinted brand fill | | `#E1E8DD` | `#213229` |
| `--pos` / `pos` (+`-soft`/`Soft`) | positive / success | success | `#2E7D5B` | `#5FBF8F` |
| `--gold` / `gold` (+soft) | caution / archived | warning | `#C08A2E` | `#D9AE5C` |
| `--neg` / `neg` (+soft) | negative / destructive | danger | `#B3462F` | `#E08462` |
| `--on-accent` / `onAccent` | text on a solid accent fill | | `#FFFFFF` | `#10231A` |
| `--on-neg` / `onNeg` | text on a solid danger fill | | `#FFFFFF` | `#2A120A` |
| `onGold` (mobile) | text on a solid gold fill | | `#FFFFFF` | `#2A1D05` |
| `--scrim` / `overlay` | dimmed backdrop behind modals | overlay | 40–45 % black | 60 % black |
| `--paper-deep` (web) | far end of the auth-page gradient | | `#EBE6DA` | `#100F0A` |

The `on*` tokens exist because the accent flips from dark green to light green: a hard-coded white label on a solid accent button would fail contrast in dark mode. Solid fills that use `ink` (dark in light mode, cream in dark mode) take `paper` for their text.

To add or change a color: edit the token in **both** places. `mobile/src/constants/theme-parity.test.ts` parses `globals.css` and fails if the web light block, web dark block, the System-mode copy of the dark block, or the mobile palette disagree.

## How it works

**Web.** The preference lives in `localStorage` (`potto-theme`: `light` | `dark`; absent = System). An inline script in `<head>` (`lib/theme.ts`) applies an explicit choice as `<html data-theme>` before first paint, so there is no flash. In System mode the attribute is absent and `globals.css` follows `prefers-color-scheme` on its own, so it also works without JavaScript and tracks OS changes live. `components/theme/` holds the provider, a one-click light/dark icon button and a toaster that follows the resolved theme. **Animation:** the icon shows the current theme (sun in light, moon in dark); on a switch the two icons turn 180° while scaling 1↔0.85 and cross-fading (350ms, transform and opacity only, in a fixed box so the header never shifts). `ThemeProvider` adds `theme-transition` to `<html>` for ~450ms around a user-initiated change, which cross-fades background, border, text, icon and shadow colors over 320ms; no layout property is animated and nothing runs on page load. `color-scheme` is held at its old value during that window because flipping it mid-fade makes Chrome restart every text-color transition each frame. With `prefers-reduced-motion` there is no turning or scaling and colors fade in 120ms. The button sits next to the notification bell in the app header (and in the public viewer's header); it flips whatever is showing, and which icon it shows (moon in light, sun in dark) is decided in CSS so it is right on first paint. On web, System is the default for new visitors and is what you get until the first click; after that the choice is explicit. (Mobile's Appearance screen still offers all three options.) The dark token block exists twice in the CSS (explicit selector + media query); that is deliberate and guarded by the parity test.

**Mobile.** `store/ThemeContext.tsx` loads the saved preference (AsyncStorage `potto.theme`) before the app renders, while the native splash is still up. `usePottoColors()` reads the scheme from `hooks/use-resolved-scheme.ts`: the explicit choice when there is one, else the device scheme. This is resolved in React, so an explicit choice applies on every platform without depending on the OS echoing a change back to JS. `Appearance.setColorScheme` is also called (`'unspecified'` returns control to the device in RN 0.86) so native chrome such as system alerts and pickers follows. The status bar and window background track the resolved scheme. On mobile the home and shared-pot headers have the same one-tap sun/moon button (Reanimated, UI thread; press scales to 0.92; long-press opens **Appearance**, which also offers System). Theme changes dissolve through the new theme's background (fade in ~120ms, swap underneath, fade out ~200ms), or a ~50/90ms fade with reduced motion; choosing System skips the dissolve. The setting is at **Appearance** (home top bar, and the shared-pot viewer's header).

Native splash: `app.json` has a `dark` variant (`assets/icons/splash-icon-dark.png`, a recolor of the light artwork). Expo Go and dev builds do not reproduce splash config; check it on a release build.

## Intentional exceptions

- The QR code tile is always white (scanners need a light quiet zone), in both themes.
- The printable pot summary (`pot-summary-html`) stays light. It is standalone HTML for paper/PDF.
- The Open Graph share image is brand artwork, not themed.
- Category colors come from a fixed 8-color palette stored as keys in the database; their icons keep the same hue in both themes (all ≥ 3:1 on the dark surface).
- `mobile/src/components/themed-text.tsx`, `themed-view.tsx`, `ui/collapsible.tsx` are unused Expo starter files and still carry starter colors.

## Contrast

Dark theme: every text/background token pairing the app uses (the ones listed in the parity test) is ≥ 4.5:1 (lowest: accent text on `accentSoft`, 4.84). The mobile test suite enforces this.

Light theme (unchanged brand colors) has existing shortfalls that were left alone:

| Pair | Ratio | Where |
|------|-------|-------|
| gold text on `goldSoft` | 2.35 | "Archived" badge |
| gold text on cream / surface | 2.7 / 3.0 | gold icons and captions |
| success green on `posSoft` | 4.28 | positive badges |

Darkening the light-mode gold and green would fix these; it changes the brand look, so it was not done here.

## Charts

Neither app has a chart library. The only data visuals are thin progress bars (pot card, contributor share), drawn from tokens (`accent`, `accent-soft`, `gold`) and readable in both themes.
