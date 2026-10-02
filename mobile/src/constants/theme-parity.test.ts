import { PottoPalette, type PottoColors } from '@/constants/potto-theme';

// Node's fs/path: this package's tsconfig deliberately ships only jest typings, so declare the
// two small surfaces used here instead of adding @types/node (and touching both lockfiles).
declare const require: (id: string) => unknown;
declare const __dirname: string;
const fs = require('node:fs') as { existsSync(p: string): boolean; readFileSync(p: string, enc: 'utf8'): string };
const path = require('node:path') as { resolve(...parts: string[]): string };

/**
 * Web and mobile each keep their own copy of the semantic color tokens (CSS variables in
 * web/src/app/globals.css, a palette object here). This test is the only thing keeping the
 * two in step, so a token changed on one side fails here until the other follows.
 */

const WEB_CSS = path.resolve(__dirname, '../../../web/src/app/globals.css');
const hasWeb = fs.existsSync(WEB_CSS);

/** CSS custom property -> palette key. */
const TOKENS: Record<string, keyof PottoColors> = {
  '--ink': 'ink',
  '--ink-soft': 'inkSoft',
  '--paper': 'paper',
  '--surface': 'surface',
  '--surface-sunk': 'surfaceSunk',
  '--line': 'line',
  '--accent': 'accent',
  '--accent-soft': 'accentSoft',
  '--pos': 'pos',
  '--pos-soft': 'posSoft',
  '--neg': 'neg',
  '--neg-soft': 'negSoft',
  '--gold': 'gold',
  '--gold-soft': 'goldSoft',
  '--on-accent': 'onAccent',
  '--on-neg': 'onNeg',
};

/** Body of the first `{ ... }` block that follows `selector`. */
function blockAfter(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found in globals.css: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function tokensIn(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[match[1]] = match[2].toLowerCase();
  return out;
}

function expected(palette: PottoColors): Record<string, string> {
  return Object.fromEntries(Object.entries(TOKENS).map(([css, key]) => [css, palette[key].toLowerCase()]));
}

const describeWeb = hasWeb ? describe : describe.skip;

describeWeb('web CSS tokens match the mobile palette', () => {
  const css = hasWeb ? fs.readFileSync(WEB_CSS, 'utf8') : '';

  it('light theme (:root)', () => {
    const light = tokensIn(blockAfter(css, ':root {'));
    for (const [cssVar, value] of Object.entries(expected(PottoPalette.light))) {
      expect([cssVar, light[cssVar]]).toEqual([cssVar, value]);
    }
  });

  it("dark theme (explicit data-theme='dark')", () => {
    const dark = tokensIn(blockAfter(css, ":root[data-theme='dark']"));
    for (const [cssVar, value] of Object.entries(expected(PottoPalette.dark))) {
      expect([cssVar, dark[cssVar]]).toEqual([cssVar, value]);
    }
  });

  it('dark theme for System mode (prefers-color-scheme) is an identical copy', () => {
    const explicit = tokensIn(blockAfter(css, ":root[data-theme='dark']"));
    const system = tokensIn(blockAfter(css, ':root:not([data-theme])'));
    expect(system).toEqual(explicit);
  });
});

// ---------------------------------------------------------------------------
// Contrast (WCAG 2.x relative luminance)
// ---------------------------------------------------------------------------

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text/background pairs that appear throughout the app (4.5:1 = WCAG AA for body text). */
const TEXT_PAIRS: [keyof PottoColors, keyof PottoColors][] = [
  ['ink', 'paper'],
  ['ink', 'surface'],
  ['ink', 'surfaceSunk'],
  ['inkSoft', 'paper'],
  ['inkSoft', 'surface'],
  ['inkSoft', 'surfaceSunk'],
  ['accent', 'paper'],
  ['accent', 'surface'],
  ['accent', 'accentSoft'],
  ['pos', 'surface'],
  ['neg', 'surface'],
  ['neg', 'negSoft'],
  ['onAccent', 'accent'],
  ['onNeg', 'neg'],
];

describe('dark theme contrast', () => {
  it.each([...TEXT_PAIRS, ['pos', 'posSoft'], ['gold', 'goldSoft'], ['gold', 'surface'], ['onGold', 'gold']] as typeof TEXT_PAIRS)(
    '%s on %s is at least 4.5:1',
    (fg, bg) => {
      expect(contrast(PottoPalette.dark[fg], PottoPalette.dark[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('light theme contrast', () => {
  // gold-on-cream and success-green-on-its-tint are existing brand colors that sit under 4.5:1
  // (documented in docs/THEME.md); everything else must hold.
  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(PottoPalette.light[fg], PottoPalette.light[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
