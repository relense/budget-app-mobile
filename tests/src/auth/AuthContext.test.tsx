import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Pressable, Text } from 'react-native';

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

let appStateHandler: (state: string) => void = () => {};
jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, handler: unknown) => {
  if (event === 'change') appStateHandler = handler as (state: string) => void;
  return { remove: jest.fn() };
}) as typeof AppState.addEventListener);

const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
const unauthenticatedError = {
  response: { errors: [{ message: 'nope', extensions: { code: 'UNAUTHENTICATED' } }] },
};

const mockRequest = jest.fn();

function Probe() {
  const { status, accessToken, signIn, signOut, requestWithAuth } = useAuth();
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
      <Pressable
        testID="makeRequest"
        onPress={() => {
          requestWithAuth(mockRequest).catch(() => {});
        }}
      >
        <Text>make request</Text>
      </Pressable>
      <Pressable
        testID="makeTwoConcurrentRequests"
        onPress={() => {
          Promise.all([requestWithAuth(mockRequest), requestWithAuth(mockRequest)]).catch(() => {});
        }}
      >
        <Text>make two requests</Text>
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
  jest.useRealTimers();
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

describe('AuthProvider requestWithAuth', () => {
  beforeEach(async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    mockedRefreshSession.mockClear();
  });

  it('passes a successful request straight through with no refresh', async () => {
    mockRequest.mockResolvedValue('data');

    await fireEvent.press(screen.getByTestId('makeRequest'));

    expect(mockRequest).toHaveBeenCalledWith('new-access');
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('refreshes once and retries after an UNAUTHENTICATED error, succeeding with the new token', async () => {
    mockRequest.mockRejectedValueOnce(unauthenticatedError).mockResolvedValueOnce('data');
    mockedRefreshSession.mockResolvedValue({ accessToken: 'rotated-access', refreshToken: 'rotated-refresh' });

    await fireEvent.press(screen.getByTestId('makeRequest'));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(2));
    expect(mockRequest).toHaveBeenNthCalledWith(1, 'new-access');
    expect(mockRequest).toHaveBeenNthCalledWith(2, 'rotated-access');
    expect(mockedRefreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('accessToken')).toHaveTextContent('rotated-access');
  });

  it('does not retry a non-auth error -- it just propagates', async () => {
    mockRequest.mockRejectedValue(new Error('network error'));

    await fireEvent.press(screen.getByTestId('makeRequest'));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('signs out if the refresh itself fails after an UNAUTHENTICATED error', async () => {
    mockRequest.mockRejectedValue(unauthenticatedError);
    mockedRefreshSession.mockRejectedValue(new Error('refresh_token_invalid'));

    await fireEvent.press(screen.getByTestId('makeRequest'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    expect(mockedClearStoredTokens).toHaveBeenCalled();
  });

  it('de-dupes concurrent refreshes -- two requests failing at once only trigger one refreshSession call', async () => {
    // Keyed on the token passed in, not call order -- both concurrent callers' *initial*
    // attempts share the same (expired) token and must both fail, and both *retries* share the
    // same freshly-rotated token and must both succeed, regardless of which caller's promise
    // happens to settle first.
    mockRequest.mockImplementation((token: string) =>
      token === 'new-access' ? Promise.reject(unauthenticatedError) : Promise.resolve(`ok-${token}`),
    );
    mockedRefreshSession.mockResolvedValue({ accessToken: 'rotated-access', refreshToken: 'rotated-refresh' });

    await fireEvent.press(screen.getByTestId('makeTwoConcurrentRequests'));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(4));
    expect(mockedRefreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a signed-out session when sign-out happens while a refresh is still in flight', async () => {
    mockedLogout.mockResolvedValue(undefined);
    mockRequest.mockRejectedValueOnce(unauthenticatedError);
    let resolveRefresh: (tokens: { accessToken: string; refreshToken: string }) => void = () => {};
    mockedRefreshSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    await fireEvent.press(screen.getByTestId('makeRequest'));
    await waitFor(() => expect(mockedRefreshSession).toHaveBeenCalledTimes(1));

    // Sign out while that refresh is still pending.
    await fireEvent.press(screen.getByTestId('signOut'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
    mockedSetStoredTokens.mockClear();

    // Now let the stale refresh resolve, late.
    await act(async () => {
      resolveRefresh({ accessToken: 'late-access', refreshToken: 'late-refresh' });
    });

    // Must stay signed out -- not resurrected by the late-arriving refresh -- and must not
    // re-persist a token pair for a session that was just explicitly ended.
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    expect(mockedSetStoredTokens).not.toHaveBeenCalled();
  });
});

describe('AuthProvider proactive refresh on app foreground', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('refreshes when the app becomes active and the current token is old enough', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    mockedRefreshSession.mockClear();
    mockedRefreshSession.mockResolvedValue({ accessToken: 'rotated-access', refreshToken: 'rotated-refresh' });

    jest.setSystemTime(new Date('2026-01-01T00:11:00.000Z')); // 11 minutes later
    await act(async () => {
      appStateHandler('active');
    });

    await waitFor(() => expect(mockedRefreshSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('accessToken')).toHaveTextContent('rotated-access'));
  });

  it('does not refresh on foreground if the current token is still fresh', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    mockedRefreshSession.mockClear();

    jest.setSystemTime(new Date('2026-01-01T00:02:00.000Z')); // 2 minutes later
    await act(async () => {
      appStateHandler('active');
    });

    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });

  it('ignores a transition to background/inactive', async () => {
    mockedGetStoredTokens.mockResolvedValue({ accessToken: 'old', refreshToken: 'old-refresh' });
    mockedRefreshSession.mockResolvedValue(newTokens);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
    mockedRefreshSession.mockClear();

    jest.setSystemTime(new Date('2026-01-01T00:11:00.000Z'));
    await act(async () => {
      appStateHandler('background');
    });

    expect(mockedRefreshSession).not.toHaveBeenCalled();
  });
});
