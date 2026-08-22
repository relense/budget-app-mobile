import * as SecureStore from 'expo-secure-store';

import {
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from '../../../src/auth/tokenStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedGetItem = SecureStore.getItemAsync as jest.Mock;
const mockedSetItem = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('tokenStorage', () => {
  it('returns null when nothing is stored', async () => {
    mockedGetItem.mockResolvedValue(null);
    expect(await getStoredTokens()).toBeNull();
  });

  it('round-trips tokens through set/get as one JSON blob', async () => {
    let stored: string | null = null;
    mockedSetItem.mockImplementation(async (_key: string, value: string) => {
      stored = value;
    });
    mockedGetItem.mockImplementation(async () => stored);

    await setStoredTokens({ accessToken: 'a', refreshToken: 'r' });

    expect(await getStoredTokens()).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('treats a corrupt (non-JSON) stored value as no tokens, not a thrown error', async () => {
    mockedGetItem.mockResolvedValue('not-json{{{');

    await expect(getStoredTokens()).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('treats a JSON value missing a token field as no tokens', async () => {
    mockedGetItem.mockResolvedValue(JSON.stringify({ accessToken: 'a' }));

    expect(await getStoredTokens()).toBeNull();
  });

  it('clearStoredTokens deletes the tokens key', async () => {
    await clearStoredTokens();
    expect(mockedDeleteItem).toHaveBeenCalledWith(expect.any(String));
  });
});
