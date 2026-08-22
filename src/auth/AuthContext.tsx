import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { isUnauthenticatedError } from '../api/graphqlClient';
import { getApiUrl } from '../lib/apiUrl';
import { logout as apiLogout, refreshSession, type AuthTokens } from './authApi';
import { authReducer } from './authReducer';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './tokenStorage';

// The access JWT is short-lived (15 min, see docs/PLAN.md) -- once a signed-in session's
// current token is at least this old, it's treated as worth refreshing proactively (on app
// foreground) rather than waiting to hit an UNAUTHENTICATED error first. Comfortably under the
// real TTL so a refresh usually lands before the token actually expires.
const PROACTIVE_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

interface AuthContextValue {
  status: 'loading' | 'signedIn' | 'signedOut';
  accessToken: string | null;
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  // Runs `request` with the current access token; if it fails with an UNAUTHENTICATED GraphQL
  // error, refreshes the session (de-duped against any refresh already in flight) and retries
  // `request` exactly once with the new token before giving up. Every query/mutation hook goes
  // through this instead of reading `accessToken` and calling the API directly.
  requestWithAuth: <T>(request: (accessToken: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { status: 'loading' });
  // De-dupes concurrent refreshes -- the refresh token is single-use (mandatory rotation on
  // the backend), so if several requests fail at once, only the first should actually call
  // refreshSession; the rest must await that same in-flight call instead of each trying to
  // rotate it independently, which would make every one but the first fail.
  const refreshPromiseRef = useRef<Promise<AuthTokens> | null>(null);

  useEffect(() => {
    async function bootstrap() {
      // Wraps the whole function, not just the parts below that already handle their own
      // specific failure -- this is fire-and-forget (no .catch at the call site below), so
      // any unexpected throw here (e.g. SecureStore.getItemAsync itself rejecting on a native
      // keychain/keystore error, not just returning a corrupt value) must never leave `status`
      // stuck at 'loading' forever with the app stranded on the splash screen.
      try {
        const stored = await getStoredTokens();
        if (!stored) {
          dispatch({ type: 'BOOTSTRAP_SIGNED_OUT' });
          return;
        }

        // Mandatory rotation on refresh means the stored refresh token is single-use -- this
        // bootstrap call both validates the session and rotates it in one step. A rejected/
        // expired refresh token is a real "sign out" case; a successful refresh followed by a
        // local persistence failure is not -- the tokens are valid, just not saved to disk, so
        // the user stays signed in for this session rather than being wrongly bounced to the
        // login screen. Keeping these as two separate try blocks is what makes that
        // distinction possible instead of collapsing both into one generic catch.
        let rotated;
        try {
          rotated = await refreshSession(getApiUrl(), stored.refreshToken);
        } catch (err) {
          console.warn('Auth bootstrap: refresh token rejected, signing out', err);
          await clearStoredTokens();
          dispatch({ type: 'BOOTSTRAP_SIGNED_OUT' });
          return;
        }

        try {
          await setStoredTokens(rotated);
        } catch (err) {
          console.warn(
            'Auth bootstrap: refreshed tokens could not be persisted locally; continuing ' +
              'signed in for this session only',
            err,
          );
        }
        dispatch({ type: 'BOOTSTRAP_SIGNED_IN', ...rotated, accessTokenIssuedAt: Date.now() });
      } catch (err) {
        console.warn('Auth bootstrap: unexpected error, signing out', err);
        dispatch({ type: 'BOOTSTRAP_SIGNED_OUT' });
      }
    }

    bootstrap();
  }, []);

  async function signIn(tokens: AuthTokens) {
    try {
      await setStoredTokens(tokens);
    } catch (err) {
      console.warn(
        'Sign-in: tokens could not be persisted locally; continuing signed in for this ' +
          'session only',
        err,
      );
    }
    dispatch({ type: 'SIGN_IN', ...tokens, accessTokenIssuedAt: Date.now() });
  }

  async function signOut() {
    if (state.status === 'signedIn') {
      try {
        await apiLogout(getApiUrl(), state.refreshToken);
      } catch {
        // Best-effort -- the device's tokens are cleared locally regardless, so a failed
        // server-side revoke just means this refresh token dies naturally at its TTL instead.
      }
    }
    await clearStoredTokens();
    dispatch({ type: 'SIGN_OUT' });
  }

  // Exchanges the current refresh token for a new access/refresh pair, single-flighted (see
  // refreshPromiseRef above). On success, persists + dispatches the rotated tokens and resolves
  // with them. On failure (refresh token revoked/expired/already-rotated), this is a genuine
  // "no longer a valid session" case -- clears storage and signs out, same as a rejected
  // refresh at bootstrap, then rethrows so the caller's own request still surfaces as failed.
  // Wrapped in useCallback (keyed on `state`, same as its own logic) rather than left as a
  // plain per-render function -- the foreground-resume effect below needs a stable reference to
  // correctly list it as a dependency, instead of re-subscribing on every single render.
  const refreshAccessToken = useCallback((): Promise<AuthTokens> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    if (state.status !== 'signedIn') {
      return Promise.reject(new Error('not_signed_in'));
    }

    const promise = (async () => {
      try {
        const rotated = await refreshSession(getApiUrl(), state.refreshToken);
        try {
          await setStoredTokens(rotated);
        } catch (err) {
          console.warn(
            'Token refresh: rotated tokens could not be persisted locally; continuing ' +
              'signed in for this session only',
            err,
          );
        }
        dispatch({ type: 'TOKEN_REFRESHED', ...rotated, accessTokenIssuedAt: Date.now() });
        return rotated;
      } catch (err) {
        console.warn('Token refresh: refresh token rejected, signing out', err);
        await clearStoredTokens();
        dispatch({ type: 'SIGN_OUT' });
        throw err;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    refreshPromiseRef.current = promise;
    return promise;
  }, [state]);

  async function requestWithAuth<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
    if (state.status !== 'signedIn') {
      throw new Error('not_signed_in');
    }
    try {
      return await request(state.accessToken);
    } catch (err) {
      if (!isUnauthenticatedError(err)) {
        throw err;
      }
      // Refresh (or await one already in flight), then retry exactly once with the new token --
      // if that also fails, let it propagate rather than looping.
      const rotated = await refreshAccessToken();
      return request(rotated.accessToken);
    }
  }

  useEffect(() => {
    // Proactive half of the refresh strategy: a request-triggered refresh (requestWithAuth
    // above) only happens once something actually fails, which means the user's first action
    // after the app sat idle always eats one failed round-trip. Refreshing on foreground-resume
    // instead means that, by the time the user's back in the app, the token's usually already
    // fresh -- catching exactly the "backgrounded the app, came back later" case that a
    // purely-reactive refresh would leave until the next request fails first.
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      if (state.status !== 'signedIn') return;
      if (Date.now() - state.accessTokenIssuedAt < PROACTIVE_REFRESH_THRESHOLD_MS) return;
      refreshAccessToken().catch(() => {
        // refreshAccessToken already signs out on failure -- nothing further to do here.
      });
    });
    return () => subscription.remove();
    // refreshAccessToken is redefined every render (it closes over `state`, same as
    // signIn/signOut above), so listing it here doesn't add a dependency beyond `state` itself.
  }, [state, refreshAccessToken]);

  const accessToken = state.status === 'signedIn' ? state.accessToken : null;

  return (
    <AuthContext.Provider
      value={{ status: state.status, accessToken, signIn, signOut, requestWithAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return value;
}
