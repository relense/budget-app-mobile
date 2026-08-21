export type AuthState =
  | { status: 'loading' }
  | { status: 'signedIn'; accessToken: string; refreshToken: string }
  | { status: 'signedOut' };

export type AuthAction =
  | { type: 'BOOTSTRAP_SIGNED_IN'; accessToken: string; refreshToken: string }
  | { type: 'BOOTSTRAP_SIGNED_OUT' }
  | { type: 'SIGN_IN'; accessToken: string; refreshToken: string }
  | { type: 'SIGN_OUT' };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'BOOTSTRAP_SIGNED_IN':
    case 'SIGN_IN':
      return {
        status: 'signedIn',
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
      };
    case 'BOOTSTRAP_SIGNED_OUT':
    case 'SIGN_OUT':
      return { status: 'signedOut' };
    default:
      return state;
  }
}
