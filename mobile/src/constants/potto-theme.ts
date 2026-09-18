import { Platform, useColorScheme } from 'react-native';

const light = {
  ink: '#1C1B19',
  inkSoft: '#6B6862',
  paper: '#F6F3EC',
  surface: '#FFFFFF',
  surfaceSunk: '#EFEBE1',
  line: '#E4DECF',
  accent: '#1F5F4E',
  accentSoft: '#DCEAE4',
  pos: '#2E7D5B',
  posSoft: '#E2F1E8',
  neg: '#C1552F',
  negSoft: '#FBEAE1',
  gold: '#B8892B',
  goldSoft: '#F3E7C9',
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
};

export const PottoPalette = { light, dark };
export type PottoColors = typeof light;

export const Radius = { sm: 9, md: 14, lg: 20, xl: 24, pill: 999 };
export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const PottoFonts = Platform.select({
  ios: { display: 'ui-serif', body: 'system-ui' },
  android: { display: 'serif', body: 'sans-serif' },
  default: { display: 'serif', body: 'System' },
})!;

export function usePottoColors(): PottoColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}
