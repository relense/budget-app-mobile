import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';

import { getApiUrl } from '../lib/apiUrl';
import { logout as apiLogout, refreshSession, type AuthTokens } from './authApi';
import { authReducer } from './authReducer';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './tokenStorage';

interface AuthContextValue {
  status: 'loading' | 'signedIn' | 'signedOut';
  accessToken: string | null;
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { status: 'loading' });

  useEffect(() => {
    async function bootstrap() {
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
      // login screen. Keeping these as two separate try blocks is what makes that distinction
      // possible instead of collapsing both into one generic catch.
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
      dispatch({ type: 'BOOTSTRAP_SIGNED_IN', ...rotated });
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
    dispatch({ type: 'SIGN_IN', ...tokens });
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

  const accessToken = state.status === 'signedIn' ? state.accessToken : null;

  return (
    <AuthContext.Provider value={{ status: state.status, accessToken, signIn, signOut }}>
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
