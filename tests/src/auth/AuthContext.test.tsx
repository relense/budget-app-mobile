import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useAuth } from '../../../src/auth/AuthContext';
import { logout, refreshSession } from '../../../src/auth/authApi';
import {
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from '../../../src/auth/tokenStorage';

jest.mock('../../../src/auth/authApi', () => ({
  ...jest.requireActual('../../../src/auth/authApi'),
  refreshSession: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../../../src/auth/tokenStorage');

const mockedRefreshSession = refreshSession as jest.Mock;
const mockedLogout = logout as jest.Mock;
const mockedGetStoredTokens = getStoredTokens as jest.Mock;
const mockedSetStoredTokens = setStoredTokens as jest.Mock;
const mockedClearStoredTokens = clearStoredTokens as jest.Mock;

const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };

function Probe() {
  const { status, accessToken, signIn, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="accessToken">{accessToken ?? ''}</Text>
      <Pressable testID="signIn" onPress={() => signIn(newTokens)}>
        <Text>sign in</Text>
      </Pressable>
      <Pressable testID="signOut" onPress={() => signOut()}>
        <Text>sign out</Text>
      </Pressable>
    </>
  );
}

async function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSetStoredTokens.mockResolvedValue(undefined);
  mockedClearStoredTokens.mockResolvedValue(undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('AuthProvider bootstrap', () => {
  it('signs out when no tokens are stored', async () => {
    mockedGetStoredTokens.mockResolvedValue(null);
    await renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('signs in with rotated tokens when the stored refresh token is valid', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    await renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(screen.getByTestId('accessToken')).toHaveTextContent('new-access');
    expect(mockedSetStoredTokens).toHaveBeenCalledWith(newTokens);
  });

  it('signs out and clears storage when the refresh token is rejected', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockRejectedValue(new Error('refresh_token_invalid'));
    await renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockedClearStoredTokens).toHaveBeenCalled();
  });

  it('signs out instead of hanging on "loading" when reading stored tokens itself throws', async () => {
    // Distinct from tokenStorage's own corrupt-JSON handling (tested in tokenStorage.test.ts) --
    // this covers the outer catch in bootstrap() itself, for a getStoredTokens() call that
    // rejects outright (e.g. a native keychain/keystore error), not one that resolves with a
    // bad value.
    mockedGetStoredTokens.mockRejectedValue(new Error('keychain read failed'));
    await renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(console.warn).toHaveBeenCalled();
  });

  it('stays signed in for this session when refresh succeeds but local persistence fails', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    mockedSetStoredTokens.mockRejectedValue(new Error('keychain write failed'));
    await renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(screen.getByTestId('accessToken')).toHaveTextContent('new-access');
    expect(mockedClearStoredTokens).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('AuthProvider signIn', () => {
  it('persists tokens and signs in', async () => {
    mockedGetStoredTokens.mockResolvedValue(null);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));

    await fireEvent.press(screen.getByTestId('signIn'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(mockedSetStoredTokens).toHaveBeenCalledWith(newTokens);
  });

  it('still signs in when persisting the new tokens fails', async () => {
    mockedGetStoredTokens.mockResolvedValue(null);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));

    mockedSetStoredTokens.mockRejectedValue(new Error('keychain write failed'));
    await fireEvent.press(screen.getByTestId('signIn'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('AuthProvider signOut', () => {
  it('clears storage and signs out even when the server-side revoke fails', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    mockedLogout.mockRejectedValue(new Error('network error'));
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    await fireEvent.press(screen.getByTestId('signOut'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockedClearStoredTokens).toHaveBeenCalled();
  });
});
