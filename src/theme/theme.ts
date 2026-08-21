import { lightColors, type Colors } from './colors';
import { typography, type Typography } from './typography';

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  typography: Typography;
}

const lightTheme: Theme = { scheme: 'light', colors: lightColors, typography };

// Dark mode has no design reference yet (every mockup we have is light-only) — resolving to
// light regardless of the requested scheme is deliberate, not an oversight, so we don't invent
// dark colors nobody has approved. Once a real dark palette exists, add a `darkTheme` object
// and return it for the 'dark' case here; every screen already reads colors through
// `useTheme()`, so no other call site needs to change.
export function resolveTheme(scheme: ColorScheme): Theme {
  return lightTheme;
}
