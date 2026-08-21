import { render, screen } from '@testing-library/react-native';

import { Toast } from '../../../src/components/Toast';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

describe('Toast', () => {
  it('renders nothing when message is null', async () => {
    await render(
      <ThemeProvider>
        <Toast message={null} />
      </ThemeProvider>,
    );

    expect(screen.queryByText(/./)).toBeNull();
  });

  it('renders the message when given one', async () => {
    await render(
      <ThemeProvider>
        <Toast message="Category already exists" />
      </ThemeProvider>,
    );

    expect(screen.getByText('Category already exists')).toBeTruthy();
  });
});
