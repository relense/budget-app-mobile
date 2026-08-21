import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function resolveApiUrl(configuredUrl: string, platformOS: string, isDev: boolean): string {
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
