export type AuthState =
  | { status: 'loading' }
  | {
      status: 'signedIn';
      accessToken: string;
      refreshToken: string;
      // When this accessToken was issued (Date.now() at the moment it was received) -- lets
      // AuthContext decide whether it's worth proactively refreshing without decoding the JWT.
      accessTokenIssuedAt: number;
    }
  | { status: 'signedOut' };

interface TokensPayload {
  accessToken: string;
  refreshToken: string;
  accessTokenIssuedAt: number;
}

export type AuthAction =
  | ({ type: 'BOOTSTRAP_SIGNED_IN' } & TokensPayload)
  | { type: 'BOOTSTRAP_SIGNED_OUT' }
  | ({ type: 'SIGN_IN' } & TokensPayload)
  // Dispatched after a mid-session refresh (reactive, on a failed request, or proactive, on
  // app foreground) rotates the tokens -- distinct from SIGN_IN, which implies a fresh login.
  | ({ type: 'TOKEN_REFRESHED' } & TokensPayload)
  | { type: 'SIGN_OUT' };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'BOOTSTRAP_SIGNED_IN':
    case 'SIGN_IN':
    case 'TOKEN_REFRESHED':
      return {
        status: 'signedIn',
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
        accessTokenIssuedAt: action.accessTokenIssuedAt,
      };
    case 'BOOTSTRAP_SIGNED_OUT':
    case 'SIGN_OUT':
      return { status: 'signedOut' };
    default:
      return state;
  }
}
