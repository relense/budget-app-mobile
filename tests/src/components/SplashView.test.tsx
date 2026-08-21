import { render, screen } from '@testing-library/react-native';

import { SplashView } from '../../../src/components/SplashView';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

describe('SplashView', () => {
  it('renders the Logo lockup without crashing', async () => {
    await render(
      <ThemeProvider>
        <SplashView />
      </ThemeProvider>,
    );

    expect(screen.getByText('Budget Tracker')).toBeTruthy();
  });
});
