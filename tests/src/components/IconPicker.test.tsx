import { fireEvent, render, screen } from '@testing-library/react-native';

import { IconPicker } from '../../../src/components/IconPicker';
import { EXPENSE_ICON_PALETTE } from '../../../src/lib/categoryIconPalette';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';

function renderPicker(props: Partial<React.ComponentProps<typeof IconPicker>> = {}) {
  return render(
    <ThemeProvider>
      <IconPicker selectedIcon="cart" onSelect={jest.fn()} {...props} />
    </ThemeProvider>,
  );
}

describe('IconPicker', () => {
  it('renders one option per palette entry', async () => {
    await renderPicker();

    for (const { icon } of EXPENSE_ICON_PALETTE) {
      expect(screen.getByTestId(`icon-option-${icon}`)).toBeTruthy();
    }
  });

  it('calls onSelect with the tapped icon', async () => {
    const onSelect = jest.fn();
    await renderPicker({ onSelect });

    await fireEvent.press(screen.getByTestId('icon-option-heart'));

    expect(onSelect).toHaveBeenCalledWith('heart');
  });

  it('centers each row of icons instead of leaving a ragged gap on the right', async () => {
    await renderPicker();

    const style = ([] as unknown[])
      .concat(screen.getByTestId('icon-picker-grid').props.style)
      .filter(Boolean) as Record<string, unknown>[];
    expect(style.some((s) => s.justifyContent === 'center')).toBe(true);
  });

  it('outlines the selected icon instead of changing its fill color', async () => {
    await renderPicker({ selectedIcon: 'heart' });

    function flatten(style: unknown): Record<string, unknown>[] {
      return ([] as unknown[]).concat(style).filter(Boolean) as Record<string, unknown>[];
    }

    const selectedStyle = flatten(screen.getByTestId('icon-option-heart').props.style);
    const unselectedStyle = flatten(screen.getByTestId('icon-option-cart').props.style);

    expect(selectedStyle.some((s) => s.borderWidth === 2)).toBe(true);
    expect(unselectedStyle.some((s) => s.borderWidth === 2)).toBe(false);
  });
});
