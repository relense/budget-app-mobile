import { fireEvent, render, screen } from '@testing-library/react-native';

import { RetryableError } from '../../../src/components/RetryableError';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

describe('RetryableError', () => {
  it('renders the given message and calls onRetry when Try again is pressed', async () => {
    const onRetry = jest.fn();
    await render(
      <ThemeProvider>
        <RetryableError message="Couldn't load your transactions." onRetry={onRetry} />
      </ThemeProvider>,
    );

    expect(screen.getByText("Couldn't load your transactions.")).toBeTruthy();

    await fireEvent.press(screen.getByTestId('retry-button'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
