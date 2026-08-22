import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCurrentMonth } from '../../../src/api/budgetHomeQueries';
import { useCategories } from '../../../src/api/categoryQueries';
import { useCreateRecurringExpense } from '../../../src/api/recurringExpenseMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import AddRecurringExpenseScreen from '../../../app/(app)/add-recurring-expense';

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/api/categoryQueries');
jest.mock('../../../src/api/recurringExpenseMutations');
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
const mockedUseCategories = useCategories as jest.Mock;
const mockedUseCreateRecurringExpense = useCreateRecurringExpense as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const createMutateAsync = jest.fn();

const shoppingCategory = {
  id: 'c-shopping',
  name: 'Shopping',
  icon: 'cart',
  color: '#4C6EF5',
  budgetType: 'NEED',
  direction: 'EXPENSE',
};

const housingCategory = {
  id: 'c-housing',
  name: 'Housing',
  icon: 'moon',
  color: '#7048E8',
  budgetType: 'NEED',
  direction: 'EXPENSE',
};

const salaryCategory = {
  id: 'c-salary',
  name: 'Salary',
  icon: 'briefcase',
  color: '#B8D8F0',
  budgetType: null,
  direction: 'INCOME',
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <AddRecurringExpenseScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseCurrentMonth.mockReturnValue({
    data: { month: '2026-09', locked: false },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockedUseCategories.mockReturnValue({
    data: [shoppingCategory, housingCategory, salaryCategory],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  createMutateAsync.mockResolvedValue(undefined);
  mockedUseCreateRecurringExpense.mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
    isError: false,
  });
});

describe('AddRecurringExpenseScreen', () => {
  it('shows a loading state while the catalog is loading', async () => {
    mockedUseCategories.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await renderScreen();

    expect(screen.getByTestId('add-recurring-expense-loading')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('shows a retryable error when the catalog fails to load', async () => {
    const refetchCategories = jest.fn();
    mockedUseCategories.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchCategories,
    });

    await renderScreen();

    expect(screen.getByTestId('add-recurring-expense-error')).toBeTruthy();
    await fireEvent.press(screen.getByText("Couldn't load your budget categories."));
  });

  it('shows an empty state when there are no expense categories, offering a way back', async () => {
    mockedUseCategories.mockReturnValue({
      data: [salaryCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByTestId('add-recurring-expense-empty')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add one from the Available tab first'));
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('defaults the category pill to the first expense category, excluding income categories', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('category-pill'));

    expect(screen.getByTestId('existing-category-c-shopping')).toBeTruthy();
    expect(screen.getByTestId('existing-category-c-housing')).toBeTruthy();
    expect(screen.queryByTestId('existing-category-c-salary')).toBeNull();
  });

  it('lets the user pick a different category from the picker', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-housing'));

    expect(screen.queryByTestId('category-picker-backdrop')).toBeNull();
  });

  it('keeps confirm disabled until name, a valid due day, and a positive amount are all set', async () => {
    await renderScreen();

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('due-day-input'), '10');
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(false);
  });

  it('rejects a due day of 0 -- confirm stays disabled even with a name and amount set', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '0');
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);
  });

  it('rejects a second due-day digit that would push the value past 31', async () => {
    await renderScreen();

    // onChangeText fires with the whole field value after each keystroke, same as a real
    // device typing one digit at a time -- '3' then '32'.
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '3');
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '32');

    expect(screen.getByTestId('due-day-input').props.value).toBe('3');
  });

  it('defaults to Need selected, and switches the highlighted button on tap', async () => {
    function flatten(style: unknown): Record<string, unknown>[] {
      return ([] as unknown[]).concat(style).filter(Boolean) as Record<string, unknown>[];
    }

    await renderScreen();

    expect(
      flatten(screen.getByTestId('budget-type-NEED').props.style).some(
        (s) => s.backgroundColor !== undefined,
      ),
    ).toBe(true);
    expect(
      flatten(screen.getByTestId('budget-type-WANT').props.style).some(
        (s) => s.backgroundColor !== undefined,
      ),
    ).toBe(false);

    await fireEvent.press(screen.getByTestId('budget-type-WANT'));

    expect(
      flatten(screen.getByTestId('budget-type-WANT').props.style).some(
        (s) => s.backgroundColor !== undefined,
      ),
    ).toBe(true);
    expect(
      flatten(screen.getByTestId('budget-type-NEED').props.style).some(
        (s) => s.backgroundColor !== undefined,
      ),
    ).toBe(false);
  });

  it('submits createRecurringExpense with the full form and navigates back', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '10');
    await fireEvent.press(screen.getByTestId('budget-type-WANT'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'Water',
      amountCents: 500,
      categoryId: 'c-shopping',
      budgetType: 'WANT',
      dueDay: 10,
      month: '2026-09',
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('shows an inline error and does not navigate back when the mutation fails', async () => {
    createMutateAsync.mockRejectedValue(new Error('network error'));
    mockedUseCreateRecurringExpense.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
      isError: true,
    });

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '10');
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });
});
