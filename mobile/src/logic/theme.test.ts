import { THEME_OPTIONS, parseThemePreference, schemeOverride } from '@/logic/theme';

describe('parseThemePreference', () => {
  it('keeps an explicit light or dark choice', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it.each([null, undefined, '', 'system', 'DARK', 'auto', 1, {}])('falls back to system for %p', (value) => {
    expect(parseThemePreference(value)).toBe('system');
  });
});

describe('schemeOverride', () => {
  it('hands control back to the device for system', () => {
    expect(schemeOverride('system')).toBe('unspecified');
  });

  it('forces the chosen scheme otherwise', () => {
    expect(schemeOverride('light')).toBe('light');
    expect(schemeOverride('dark')).toBe('dark');
  });
});

describe('THEME_OPTIONS', () => {
  it('offers Light, Dark and System exactly once', () => {
    expect(THEME_OPTIONS.map((o) => o.value).sort()).toEqual(['dark', 'light', 'system']);
  });
});
