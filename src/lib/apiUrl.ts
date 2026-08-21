import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function resolveApiUrl(configuredUrl: string, platformOS: string, isDev: boolean): string {
  // Only correct for the Android emulator's virtual network — a physical Android device
  // reaching this branch would get an unreachable 10.0.2.2, not a working connection.
  // No physical-device signal is available here to distinguish the two; revisit if/when
  // device testing starts (e.g. an explicit env override for device runs).
  if (isDev && platformOS === 'android' && configuredUrl.includes('localhost')) {
    return configuredUrl.replace('localhost', '10.0.2.2');
  }
  return configuredUrl;
}

export function getApiUrl(): string {
  const configuredUrl =
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4400';
  return resolveApiUrl(configuredUrl, Platform.OS, __DEV__);
}
