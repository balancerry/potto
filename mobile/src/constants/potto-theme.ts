import { Platform } from 'react-native';

import { useResolvedScheme } from '@/hooks/use-resolved-scheme';

/**
 * Semantic color tokens. Mapping to the generic names used in the design brief:
 *   background -> paper         surface -> surface        surfaceSecondary -> surfaceSunk
 *   textPrimary -> ink          textSecondary -> inkSoft  border -> line
 *   primary -> accent           success -> pos            warning -> gold
 *   danger -> neg               icon -> inkSoft           overlay -> overlay
 * `on*` tokens are the text/icon color that sits ON a solid fill of that color.
 *
 * Web uses the same values as CSS variables in web/src/app/globals.css; the
 * theme-parity test fails if the two drift.
 */
const light = {
  ink: '#23211D',
  inkSoft: '#655F52',
  paper: '#F5F0E4',
  surface: '#FFFDF7',
  surfaceSunk: '#EFE9D9',
  line: '#E2D8BE',
  accent: '#1E3A2B',
  accentSoft: '#E1E8DD',
  pos: '#2E7D5B',
  posSoft: '#E2F1E8',
  neg: '#B3462F',
  negSoft: '#FBEAE1',
  gold: '#C08A2E',
  goldSoft: '#F1E1BC',
  onAccent: '#FFFFFF',
  onNeg: '#FFFFFF',
  onGold: '#FFFFFF',
  overlay: 'rgba(20,18,14,0.45)',
};

const dark = {
  ink: '#F2EFE6',
  inkSoft: '#A9A398',
  paper: '#17160F',
  surface: '#211F17',
  surfaceSunk: '#191811',
  line: '#332F23',
  accent: '#5CA98E',
  accentSoft: '#213229',
  pos: '#5FBF8F',
  posSoft: '#1B2E22',
  neg: '#E08462',
  negSoft: '#33201A',
  gold: '#D9AE5C',
  goldSoft: '#3A2F16',
  onAccent: '#10231A',
  onNeg: '#2A120A',
  onGold: '#2A1D05',
  overlay: 'rgba(0,0,0,0.6)',
};

export const PottoPalette = { light, dark };
export type PottoColors = Record<keyof typeof light, string>;

export const Radius = { sm: 9, md: 14, lg: 20, xl: 24, pill: 999 };
export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const PottoFonts = Platform.select({
  ios: { display: 'ui-serif', body: 'System', sans: 'System' },
  android: { display: 'serif', body: 'sans-serif', sans: 'sans-serif' },
  default: { display: 'serif', body: 'System', sans: 'System' },
})!;

export function usePottoColors(): PottoColors {
  return useResolvedScheme() === 'dark' ? dark : light;
}
