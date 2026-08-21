import { createContext, useContext, type ReactNode } from 'react';

import { resolveTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Not reading the system color scheme (react-native's useColorScheme) yet: resolveTheme
  // always returns the light theme regardless of input until dark mode is actually designed
  // (no dark mockups exist), so wiring it up now would be dead code with no effect. Add it
  // back alongside useColorScheme() once a real dark palette exists.
  const theme = resolveTheme('light');

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return theme;
}
