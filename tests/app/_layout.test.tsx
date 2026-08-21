import { render, screen } from '@testing-library/react-native';

import { useAuth } from '../../src/auth/AuthContext';
import RootLayout from '../../app/_layout';

jest.mock('../../src/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { Text: TextActual } = require('react-native');
  function Stack({ children }: { children: React.ReactNode }) {
    return children;
  }
  Stack.Screen = function StackScreen({ name }: { name: string }) {
    return ReactActual.createElement(TextActual, null, `screen:${name}`);
  };
  Stack.Protected = function StackProtected({
    guard,
    children,
  }: {
    guard: boolean;
    children: React.ReactNode;
  }) {
    return guard ? children : null;
  };
  return { Stack };
});

const mockedUseAuth = useAuth as jest.Mock;

async function renderLayout() {
  return render(<RootLayout />);
}

describe('RootLayout / RootNavigator', () => {
  it('shows the splash view while auth is loading, no route rendered yet', async () => {
    mockedUseAuth.mockReturnValue({ status: 'loading' });
    await renderLayout();

    expect(screen.getByText('Budget Tracker')).toBeTruthy();
    expect(screen.queryByText('screen:(app)')).toBeNull();
    expect(screen.queryByText('screen:(auth)')).toBeNull();
  });

  it('renders the (app) route and not (auth) when signed in', async () => {
    mockedUseAuth.mockReturnValue({ status: 'signedIn' });
    await renderLayout();

    expect(screen.getByText('screen:(app)')).toBeTruthy();
    expect(screen.queryByText('screen:(auth)')).toBeNull();
  });

  it('renders the (auth) route and not (app) when signed out', async () => {
    mockedUseAuth.mockReturnValue({ status: 'signedOut' });
    await renderLayout();

    expect(screen.getByText('screen:(auth)')).toBeTruthy();
    expect(screen.queryByText('screen:(app)')).toBeNull();
  });
});
