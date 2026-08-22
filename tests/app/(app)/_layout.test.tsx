import { render, screen } from '@testing-library/react-native';

import AppLayout from '../../../app/(app)/_layout';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  const { Text: TextActual } = require('react-native');
  function Stack({ children }: { children: React.ReactNode }) {
    return children;
  }
  Stack.Screen = function StackScreen({
    name,
    options,
  }: {
    name: string;
    options?: { presentation?: string };
  }) {
    return ReactActual.createElement(
      TextActual,
      null,
      `screen:${name}:${options?.presentation ?? 'none'}`,
    );
  };
  return { Stack };
});

// Regression test: every screen that opens as a bottom-sheet grabber ("drawer") in its own
// JSX only actually presents that way if it's also registered here with
// presentation: 'modal' -- a screen can have the grabber UI built and still push as a plain
// full-screen stack route if this registration is missing (exactly what happened to
// add-recurring-expense/edit-recurring-expense/add-income/income-received: the JSX was right,
// this file just never listed them).
const MODAL_SCREENS = [
  'add-category',
  'edit-category',
  'add-transaction',
  'edit-transaction',
  'add-recurring-expense',
  'edit-recurring-expense',
  'add-income',
  'income-received',
];

describe('(app)/_layout', () => {
  it('registers index as a plain (non-modal) screen', async () => {
    await render(<AppLayout />);

    expect(screen.getByText('screen:index:none')).toBeTruthy();
  });

  it.each(MODAL_SCREENS)('registers %s with presentation: modal', async (name) => {
    await render(<AppLayout />);

    expect(screen.getByText(`screen:${name}:modal`)).toBeTruthy();
  });
});
