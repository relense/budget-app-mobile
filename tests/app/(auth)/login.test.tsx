import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { OtpRequestError, requestOtp } from '../../../src/auth/authApi';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import LoginScreen from '../../../app/(auth)/login';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../src/auth/authApi', () => ({
  ...jest.requireActual('../../../src/auth/authApi'),
  requestOtp: jest.fn(),
}));

const mockedRequestOtp = requestOtp as jest.Mock;

async function renderLogin() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('shows a validation error for an invalid email and does not call the API', async () => {
    await renderLogin();

    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'not-an-email');
    await fireEvent.press(screen.getByText('Send code'));

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(mockedRequestOtp).not.toHaveBeenCalled();
  });

  it('requests a code and navigates to /verify on a valid email', async () => {
    mockedRequestOtp.mockResolvedValue(undefined);
    await renderLogin();

    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    await fireEvent.press(screen.getByText('Send code'));

    await waitFor(() =>
      expect(mockedRequestOtp).toHaveBeenCalledWith(expect.any(String), 'user@example.com'),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/verify',
      params: { email: 'user@example.com' },
    });
  });

  it('shows a rate-limit message when the backend rejects with rate_limited', async () => {
    mockedRequestOtp.mockRejectedValue(new OtpRequestError('rate_limited'));
    await renderLogin();

    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    await fireEvent.press(screen.getByText('Send code'));

    await waitFor(() =>
      expect(screen.getByText('Too many requests — try again in a few minutes.')).toBeTruthy(),
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a generic error message for a non-OtpRequestError failure', async () => {
    mockedRequestOtp.mockRejectedValue(new Error('network error'));
    await renderLogin();

    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'user@example.com');
    await fireEvent.press(screen.getByText('Send code'));

    await waitFor(() =>
      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy(),
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});
