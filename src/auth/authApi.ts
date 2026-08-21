export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface VerifyOtpResult extends AuthTokens {
  user: AuthUser;
}

export type OtpRequestErrorCode = 'rate_limited' | 'unknown';

export class OtpRequestError extends Error {
  constructor(public readonly code: OtpRequestErrorCode) {
    super(code);
    this.name = 'OtpRequestError';
  }
}

export type OtpVerifyErrorCode =
  'code_not_found' | 'code_expired' | 'too_many_attempts' | 'incorrect_code';

export class OtpVerifyError extends Error {
  constructor(public readonly code: OtpVerifyErrorCode) {
    super(code);
    this.name = 'OtpVerifyError';
  }
}

export async function requestOtp(baseUrl: string, email: string): Promise<void> {
  const response = await fetch(`${baseUrl}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new OtpRequestError(response.status === 429 ? 'rate_limited' : 'unknown');
  }
}

export async function verifyOtp(
  baseUrl: string,
  input: { email: string; code: string; deviceLabel?: string },
): Promise<VerifyOtpResult> {
  const response = await fetch(`${baseUrl}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    if (response.status === 401) {
      const body = (await response.json()) as { error: OtpVerifyErrorCode };
      throw new OtpVerifyError(body.error);
    }
    throw new Error(`verifyOtp failed with status ${response.status}`);
  }

  return (await response.json()) as VerifyOtpResult;
}

export async function refreshSession(baseUrl: string, refreshToken: string): Promise<AuthTokens> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error('refresh_token_invalid');
  }

  return (await response.json()) as AuthTokens;
}

export async function logout(baseUrl: string, refreshToken: string): Promise<void> {
  const response = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`logout failed with status ${response.status}`);
  }
}
