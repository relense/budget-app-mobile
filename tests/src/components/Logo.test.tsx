import { render, screen } from '@testing-library/react-native';

import { Logo } from '../../../src/components/Logo';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

describe('Logo', () => {
  it('renders the logo image and wordmark without crashing', async () => {
    await render(
      <ThemeProvider>
        <Logo />
      </ThemeProvider>,
    );

    expect(screen.getByText('Budget Tracker')).toBeTruthy();
  });
});
