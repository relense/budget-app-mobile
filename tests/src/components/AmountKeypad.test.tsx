import { fireEvent, render, screen } from '@testing-library/react-native';

import { AmountKeypad } from '../../../src/components/AmountKeypad';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

async function renderKeypad(props: Partial<React.ComponentProps<typeof AmountKeypad>> = {}) {
  const onDigit = jest.fn();
  const onDecimalPoint = jest.fn();
  const onBackspace = jest.fn();
  const onConfirm = jest.fn();

  await render(
    <ThemeProvider>
      <AmountKeypad
        onDigit={onDigit}
        onDecimalPoint={onDecimalPoint}
        onBackspace={onBackspace}
        onConfirm={onConfirm}
        {...props}
      />
    </ThemeProvider>,
  );

  return { onDigit, onDecimalPoint, onBackspace, onConfirm };
}

describe('AmountKeypad', () => {
  it('calls onDigit with the pressed digit', async () => {
    const { onDigit } = await renderKeypad();

    await fireEvent.press(screen.getByTestId('keypad-digit-7'));

    expect(onDigit).toHaveBeenCalledWith('7');
  });

  it('calls onDigit with 0 for the zero key', async () => {
    const { onDigit } = await renderKeypad();

    await fireEvent.press(screen.getByTestId('keypad-digit-0'));

    expect(onDigit).toHaveBeenCalledWith('0');
  });

  it('calls onDecimalPoint when the . key is pressed', async () => {
    const { onDecimalPoint } = await renderKeypad();

    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));

    expect(onDecimalPoint).toHaveBeenCalled();
  });

  it('calls onBackspace when the delete key is pressed', async () => {
    const { onBackspace } = await renderKeypad();

    await fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(onBackspace).toHaveBeenCalled();
  });

  it('calls onConfirm when the confirm key is pressed', async () => {
    const { onConfirm } = await renderKeypad();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not call onConfirm when disabled', async () => {
    const { onConfirm } = await renderKeypad({ confirmDisabled: true });

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not render a date-toggle key when onToggleDateMode is not passed', async () => {
    await renderKeypad();

    expect(screen.queryByTestId('keypad-toggle-date')).toBeNull();
  });

  it('calls onToggleDateMode when the calendar key is pressed', async () => {
    const onToggleDateMode = jest.fn();
    await renderKeypad({ onToggleDateMode });

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(onToggleDateMode).toHaveBeenCalled();
  });
});
