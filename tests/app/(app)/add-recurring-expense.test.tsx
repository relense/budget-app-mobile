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

// Deliberately WANT (not NEED, like shoppingCategory) -- lets tests prove budgetType is
// derived from whichever category is selected, not defaulted/hardcoded.
const housingCategory = {
  id: 'c-housing',
  name: 'Housing',
  icon: 'moon',
  color: '#7048E8',
  budgetType: 'WANT',
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
  // September (30 days) -- deliberately not 31, so a "31" attempt or an "August/other month"
  // day-count mixup would be caught by the reject-past-month-end test below.
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

  it('shows the amount by default, with no "Amount" label and no due-date row visible yet', async () => {
    await renderScreen();

    expect(screen.queryByText('Amount')).toBeNull();
    expect(screen.getByTestId('calculator-value').props.children).toBe('0');
    expect(screen.queryByTestId('due-day-value')).toBeNull();
    expect(screen.queryByTestId('due-month-year-value')).toBeNull();
  });

  it('pressing the calendar key swaps the single calculator display over to the due date (day placeholder + fixed month/year), same as Add Transaction -- the amount is no longer shown', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(screen.queryByTestId('calculator-value')).toBeNull();
    expect(screen.getByTestId('due-day-value').props.children).toBe('--');
    expect(screen.getByTestId('due-month-year-value').props.children).toBe(' Sep 2026');
  });

  it('typing digits in day-entry mode updates the due-day value shown in that same swapped display', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('10');
    expect(screen.getByTestId('due-month-year-value').props.children).toBe(' Sep 2026');
  });

  it('toggling back to amount mode restores the amount display and preserves the typed due day for later', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(screen.getByTestId('calculator-value').props.children).toBe('0');
    expect(screen.queryByTestId('due-day-value')).toBeNull();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    expect(screen.getByTestId('calculator-value').props.children).toBe('5');

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    expect(screen.getByTestId('due-day-value').props.children).toBe('10');
  });

  it('keeps confirm disabled until name, a valid due day, and a positive amount are all set', async () => {
    await renderScreen();

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(false);
  });

  it('rejects a due day of 0 -- confirm stays disabled even with a name and amount set', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);
  });

  it('rejects a second due-day digit that would push the day past the current month\'s real day count (September has 30, not 31)', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-3'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('3');
  });

  it('the decimal-point key is a no-op while in day-entry mode', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('10');
  });

  it('has no Need/Want picker at all -- budgetType is derived from the selected category, not asked for', async () => {
    await renderScreen();

    expect(screen.queryByText('Need')).toBeNull();
    expect(screen.queryByText('Want')).toBeNull();
  });

  it('submits createRecurringExpense with the default category\'s (NEED) derived budgetType, and navigates back', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water');
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'Water',
      amountCents: 500,
      categoryId: 'c-shopping',
      budgetType: 'NEED',
      dueDay: 10,
      month: '2026-09',
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('submits the WANT-budgeted category\'s own derived budgetType when a different category is picked', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Rent');
    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-housing'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'c-housing', budgetType: 'WANT' }),
    );
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
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });
});
