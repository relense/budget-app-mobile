import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from './authApi';

// One key holding both tokens as JSON, not two separate keys -- a single SecureStore write
// can't partially fail the way two independent writes could (e.g. access token written,
// refresh token write throws, leaving a mismatched pair on disk).
const TOKENS_KEY = 'budget_tracker_tokens';

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY);
  if (!raw) {
    return null;
  }

  let parsed: AuthTokens;
  try {
    parsed = JSON.parse(raw) as AuthTokens;
  } catch (err) {
    // An unparseable value (corrupt write, future format change) is treated the same as "no
    // tokens" -- letting this throw would reject bootstrap()'s fire-and-forget promise with
    // no handler, silently stranding the app on the loading/splash screen forever.
    console.warn('Stored auth tokens were not valid JSON, treating as signed out', err);
    return null;
  }

  if (!parsed.accessToken || !parsed.refreshToken) {
    return null;
  }

  return parsed;
}

export async function setStoredTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearStoredTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}
