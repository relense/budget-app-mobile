import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCategories } from '../../../src/api/categoryQueries';
import {
  useMarkRecurringPaid,
  useRemoveRecurringExpenseFromMonth,
  useUnmarkRecurringPaid,
  useUpdateRecurringExpense,
} from '../../../src/api/recurringExpenseMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import EditRecurringExpenseScreen from '../../../app/(app)/edit-recurring-expense';

jest.mock('../../../src/api/categoryQueries');
jest.mock('../../../src/api/recurringExpenseMutations');
jest.mock('../../../src/lib/today', () => ({
  todayIsoDate: () => '2026-09-15',
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const mockedUseCategories = useCategories as jest.Mock;
const mockedUseUpdateRecurringExpense = useUpdateRecurringExpense as jest.Mock;
const mockedUseMarkRecurringPaid = useMarkRecurringPaid as jest.Mock;
const mockedUseUnmarkRecurringPaid = useUnmarkRecurringPaid as jest.Mock;
const mockedUseRemoveRecurringExpenseFromMonth = useRemoveRecurringExpenseFromMonth as jest.Mock;
const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const updateMutateAsync = jest.fn();
const markPaidMutateAsync = jest.fn();
const unmarkPaidMutateAsync = jest.fn();
const removeMutateAsync = jest.fn();

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

const baseParams = {
  recurringExpenseId: 're-water',
  name: 'Water',
  amountCents: '2196',
  categoryId: 'c-shopping',
  categoryIcon: 'cart',
  categoryColor: '#4C6EF5',
  budgetType: 'NEED',
  dueDay: '10',
  paidThisMonth: 'false',
  transactionIds: '[]',
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <EditRecurringExpenseScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseLocalSearchParams.mockReturnValue(baseParams);
  mockedUseCategories.mockReturnValue({
    data: [shoppingCategory, housingCategory],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  updateMutateAsync.mockResolvedValue(undefined);
  markPaidMutateAsync.mockResolvedValue(undefined);
  unmarkPaidMutateAsync.mockResolvedValue(undefined);
  removeMutateAsync.mockResolvedValue(undefined);
  mockedUseUpdateRecurringExpense.mockReturnValue({
    mutateAsync: updateMutateAsync,
    isPending: false,
  });
  mockedUseMarkRecurringPaid.mockReturnValue({ mutateAsync: markPaidMutateAsync, isPending: false });
  mockedUseUnmarkRecurringPaid.mockReturnValue({
    mutateAsync: unmarkPaidMutateAsync,
    isPending: false,
  });
  mockedUseRemoveRecurringExpenseFromMonth.mockReturnValue({
    mutateAsync: removeMutateAsync,
    isPending: false,
  });
});

describe('EditRecurringExpenseScreen', () => {
  it('pre-fills name, amount, and due day from route params', async () => {
    await renderScreen();

    expect(screen.getByTestId('recurring-name-input').props.value).toBe('Water');
    expect(screen.getByTestId('due-day-input').props.value).toBe('10');
    expect(screen.getByText('21.96')).toBeTruthy();
  });

  it('shows Unpaid when paidThisMonth is false', async () => {
    await renderScreen();

    expect(screen.getByTestId('paid-pill')).toBeTruthy();
    expect(screen.getByText('Unpaid')).toBeTruthy();
  });

  it('shows Paid when paidThisMonth is true', async () => {
    mockedUseLocalSearchParams.mockReturnValue({ ...baseParams, paidThisMonth: 'true' });

    await renderScreen();

    expect(screen.getByText('Paid')).toBeTruthy();
  });

  it('tapping the pill while Unpaid marks it paid with the current amount and today, then goes back', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('paid-pill'));

    expect(markPaidMutateAsync).toHaveBeenCalledWith({
      recurringExpenseId: 're-water',
      amountCents: 2196,
      date: '2026-09-15',
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('tapping the pill while Paid unmarks it via useUnmarkRecurringPaid with every linked transaction id, and goes back', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      ...baseParams,
      paidThisMonth: 'true',
      transactionIds: '["t-1","t-2"]',
    });

    await renderScreen();

    await fireEvent.press(screen.getByTestId('paid-pill'));

    expect(unmarkPaidMutateAsync).toHaveBeenCalledWith(['t-1', 't-2']);
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('shows a toast and does not navigate back when unmarking paid fails (e.g. a partial delete failure)', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      ...baseParams,
      paidThisMonth: 'true',
      transactionIds: '["t-1","t-2"]',
    });
    unmarkPaidMutateAsync.mockRejectedValue(new Error('Failed to delete 1 of 2 linked transactions'));

    await renderScreen();
    await fireEvent.press(screen.getByTestId('paid-pill'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('lets the user edit name, category, Need/Want, due day, and amount, then saves via updateRecurringExpense', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water Bill');
    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-housing'));
    await fireEvent.press(screen.getByTestId('budget-type-WANT'));
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '5');
    // The first keypad press clears the whole pre-filled amount and starts fresh (same "start
    // fresh on the first press" rule as edit-category.tsx), so this ends up typing "50" from
    // scratch -> 5000 cents, not 21.96 with a 5 and a 0 appended.
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      recurringExpenseId: 're-water',
      name: 'Water Bill',
      amountCents: 5000,
      categoryId: 'c-housing',
      budgetType: 'WANT',
      dueDay: 5,
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('rejects a due day of 0 -- confirm stays disabled', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('due-day-input'), '0');

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);
  });

  it('rejects a second due-day digit that would push the value past 31', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('due-day-input'), '3');
    await fireEvent.changeText(screen.getByTestId('due-day-input'), '32');

    expect(screen.getByTestId('due-day-input').props.value).toBe('3');
  });

  it('shows a hint toast instead of the delete confirm when Delete is pressed while Paid (blocked server-side)', async () => {
    mockedUseLocalSearchParams.mockReturnValue({ ...baseParams, paidThisMonth: 'true' });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await renderScreen();
    await fireEvent.press(screen.getByTestId('delete-recurring-expense-button'));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(removeMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText('Mark as unpaid before deleting.')).toBeTruthy();

    alertSpy.mockRestore();
  });

  it('deletes the recurring expense after confirming the destructive alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('delete-recurring-expense-button'));

    expect(alertSpy).toHaveBeenCalled();
    expect(removeMutateAsync).toHaveBeenCalledWith({ recurringExpenseId: 're-water' });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });

  it('shows a toast and does not navigate back when marking paid fails', async () => {
    markPaidMutateAsync.mockRejectedValue(new Error('network error'));

    await renderScreen();
    await fireEvent.press(screen.getByTestId('paid-pill'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('still calls useUnmarkRecurringPaid (with an empty array) and navigates back if Paid but somehow no transaction ids are known', async () => {
    // A data-integrity edge case (paidThisMonth true but transactionIds empty) rather than a
    // normal path -- documents that this doesn't silently no-op: the mutation is still called
    // (with []), and its own onSettled invalidation is what makes the Recurrent tab re-fetch
    // and show whatever the server actually has, rather than this screen faking success.
    mockedUseLocalSearchParams.mockReturnValue({
      ...baseParams,
      paidThisMonth: 'true',
      transactionIds: '[]',
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('paid-pill'));

    expect(unmarkPaidMutateAsync).toHaveBeenCalledWith([]);
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });
});
