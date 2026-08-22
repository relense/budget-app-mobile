import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExistingCategoryPicker } from '../../../src/components/ExistingCategoryPicker';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import type { Category } from '../../../src/api/types';

const categories: Category[] = [
  {
    id: 'c1',
    name: 'Shopping',
    icon: 'cart',
    color: '#D2FFD8',
    budgetType: 'NEED',
    direction: 'EXPENSE',
  },
  {
    id: 'c2',
    name: 'Gas',
    icon: 'fuel',
    color: '#FFCCDB',
    budgetType: 'NEED',
    direction: 'EXPENSE',
  },
];

async function renderPicker(
  props: Partial<React.ComponentProps<typeof ExistingCategoryPicker>> = {},
) {
  const onSelectExisting = jest.fn();

  await render(
    <ThemeProvider>
      <ExistingCategoryPicker
        categories={categories}
        onSelectExisting={onSelectExisting}
        {...props}
      />
    </ThemeProvider>,
  );

  return { onSelectExisting };
}

describe('ExistingCategoryPicker', () => {
  it('shows one row per unused category, by name', async () => {
    await renderPicker();

    expect(screen.getByText('Shopping')).toBeTruthy();
    expect(screen.getByText('Gas')).toBeTruthy();
  });

  it('renders categories in alphabetical order regardless of input order', async () => {
    // Fixture order above is Shopping (c1) then Gas (c2) -- the opposite of alphabetical, so
    // this only passes if the component is actually sorting, not just echoing the input order.
    await renderPicker();

    const rows = screen.getAllByTestId(/^existing-category-/);
    expect(rows.map((row) => row.props.testID)).toEqual([
      'existing-category-c2',
      'existing-category-c1',
    ]);
  });

  it('calls onSelectExisting with the tapped category', async () => {
    const { onSelectExisting } = await renderPicker();

    await fireEvent.press(screen.getByTestId('existing-category-c2'));

    expect(onSelectExisting).toHaveBeenCalledWith(categories[1]);
  });
});
