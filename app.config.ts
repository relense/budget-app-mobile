import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Budget Tracker',
  slug: 'budget-tracker',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'budgettracker',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.relense.budgettracker',
  },
  android: {
    package: 'com.relense.budgettracker',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    // No image yet -- no real app icon/logo exists. Solid mint-green background only; the
    // JS-rendered wordmark (src/components/SplashView.tsx) takes over within a frame or two
    // of the native splash showing, for the duration of the auth bootstrap check.
    ['expo-splash-screen', { backgroundColor: '#CFF3DA' }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Backend base URL. Overridable via the API_URL env var (see .env.example) —
    // read via expo-constants at runtime (src/lib/apiUrl.ts), not process.env directly,
    // since Android-emulator vs. device/localhost resolution needs a platform check too.
    apiUrl: process.env.API_URL ?? 'http://localhost:4400',
  },
});
