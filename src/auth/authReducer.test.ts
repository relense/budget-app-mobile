import { authReducer, type AuthState } from './authReducer';

const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1' };

describe('authReducer', () => {
  it('starts loading and transitions to signedIn on bootstrap success', () => {
    const loading: AuthState = { status: 'loading' };
    const next = authReducer(loading, { type: 'BOOTSTRAP_SIGNED_IN', ...tokens });

    expect(next).toEqual({ status: 'signedIn', ...tokens });
  });

  it('transitions to signedOut on bootstrap failure', () => {
    const loading: AuthState = { status: 'loading' };
    const next = authReducer(loading, { type: 'BOOTSTRAP_SIGNED_OUT' });

    expect(next).toEqual({ status: 'signedOut' });
  });

  it('signs in from signedOut', () => {
    const signedOut: AuthState = { status: 'signedOut' };
    const next = authReducer(signedOut, { type: 'SIGN_IN', ...tokens });

    expect(next).toEqual({ status: 'signedIn', ...tokens });
  });

  it('signs out from signedIn', () => {
    const signedIn: AuthState = { status: 'signedIn', ...tokens };
    const next = authReducer(signedIn, { type: 'SIGN_OUT' });

    expect(next).toEqual({ status: 'signedOut' });
  });
});
