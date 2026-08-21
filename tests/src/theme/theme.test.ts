import { resolveTheme } from '../../../src/theme/theme';

describe('resolveTheme', () => {
  it('returns the light theme for scheme "light"', () => {
    const theme = resolveTheme('light');
    expect(theme.scheme).toBe('light');
    expect(theme.colors.background.screen).toBe('#FFFFFF');
  });

  it('falls back to the light theme for scheme "dark" (no dark design exists yet)', () => {
    const theme = resolveTheme('dark');
    expect(theme.scheme).toBe('light');
  });
});
