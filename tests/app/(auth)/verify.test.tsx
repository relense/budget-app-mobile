import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useAuth } from '../../../src/auth/AuthContext';
import { OtpVerifyError, verifyOtp } from '../../../src/auth/authApi';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import VerifyScreen from '../../../app/(auth)/verify';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ email: 'user@example.com' }),
}));
jest.mock('../../../src/auth/authApi', () => ({
  ...jest.requireActual('../../../src/auth/authApi'),
  verifyOtp: jest.fn(),
}));
jest.mock('../../../src/auth/AuthContext');

const mockedVerifyOtp = verifyOtp as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockSignIn = jest.fn();

async function renderVerify() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <VerifyScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ signIn: mockSignIn });
});

describe('VerifyScreen', () => {
  it('shows the email the code was sent to', async () => {
    await renderVerify();
    expect(screen.getByText('We sent a 6-character code to user@example.com.')).toBeTruthy();
  });

  it('auto-submits and signs in once 6 characters are entered', async () => {
    const result = {
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 'u1', email: 'user@example.com' },
    };
    mockedVerifyOtp.mockResolvedValue(result);
    await renderVerify();

    await fireEvent.changeText(screen.getByDisplayValue(''), 'AB12CD');

    await waitFor(() =>
      expect(mockedVerifyOtp).toHaveBeenCalledWith(expect.any(String), {
        email: 'user@example.com',
        code: 'AB12CD',
      }),
    );
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith(result));
  });

  it('shows the mapped message for an expired code and clears the input', async () => {
    mockedVerifyOtp.mockRejectedValue(new OtpVerifyError('code_expired'));
    await renderVerify();

    await fireEvent.changeText(screen.getByDisplayValue(''), 'AB12CD');

    await waitFor(() =>
      expect(screen.getByText('This code has expired. Request a new one.')).toBeTruthy(),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('disables resend during the initial cooldown', async () => {
    await renderVerify();
    expect(screen.getByText('Resend code in 0:30')).toBeTruthy();
  });
});
