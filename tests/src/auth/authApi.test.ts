import {
  OtpVerifyError,
  logout,
  requestOtp,
  refreshSession,
  verifyOtp,
} from '../../../src/auth/authApi';

const BASE_URL = 'http://localhost:4400';

describe('requestOtp', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('posts the email and resolves on success', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    await requestOtp(BASE_URL, 'user@example.com');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/auth/request-otp`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });

  it('throws a rate_limited error on 429', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429 });

    await expect(requestOtp(BASE_URL, 'user@example.com')).rejects.toMatchObject({
      code: 'rate_limited',
    });
  });

  it('throws an unknown error on any other failure', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(requestOtp(BASE_URL, 'user@example.com')).rejects.toMatchObject({
      code: 'unknown',
    });
  });
});

describe('verifyOtp', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('returns tokens and user on success', async () => {
    const body = {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 'u1', email: 'user@example.com' },
    };
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });

    const result = await verifyOtp(BASE_URL, { email: 'user@example.com', code: 'AB12CD' });

    expect(result).toEqual(body);
  });

  it('throws an OtpVerifyError with the backend error code on 401', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'incorrect_code' }),
    });

    await expect(
      verifyOtp(BASE_URL, { email: 'user@example.com', code: 'WRONG1' }),
    ).rejects.toBeInstanceOf(OtpVerifyError);
  });

  it('carries the specific error code through', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'code_expired' }),
    });

    try {
      await verifyOtp(BASE_URL, { email: 'user@example.com', code: 'AB12CD' });
      throw new Error('expected verifyOtp to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(OtpVerifyError);
      expect((err as OtpVerifyError).code).toBe('code_expired');
    }
  });
});

describe('refreshSession', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('returns the rotated tokens on success', async () => {
    const body = { accessToken: 'access-2', refreshToken: 'refresh-2' };
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    });

    const result = await refreshSession(BASE_URL, 'refresh-1');

    expect(result).toEqual(body);
  });

  it('throws on an invalid/revoked refresh token', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 });

    await expect(refreshSession(BASE_URL, 'stale-token')).rejects.toThrow();
  });
});

describe('logout', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  it('posts the refresh token and resolves on success', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });

    await logout(BASE_URL, 'refresh-1');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/auth/logout`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'refresh-1' }),
      }),
    );
  });

  it('throws on a non-ok response', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(logout(BASE_URL, 'refresh-1')).rejects.toThrow();
  });
});
