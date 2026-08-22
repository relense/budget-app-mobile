import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, Keyboard } from 'react-native';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCurrentMonth } from '../../../src/api/budgetHomeQueries';
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

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/api/categoryQueries');
jest.mock('../../../src/api/recurringExpenseMutations');
jest.mock('../../../src/lib/today', () => ({
  todayIsoDate: () => '2026-09-15',
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

let keyboardDidShow: () => void = () => {};
let keyboardDidHide: () => void = () => {};

jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
  if (event === 'keyboardDidShow') keyboardDidShow = callback as () => void;
  if (event === 'keyboardDidHide') keyboardDidHide = callback as () => void;
  return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
});

const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
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
  // September (30 days) -- deliberately not 31, same reasoning as add-recurring-expense.test.tsx.
  mockedUseCurrentMonth.mockReturnValue({
    data: { month: '2026-09', locked: false },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
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
  it('shows a loading state while the current month is loading', async () => {
    mockedUseCurrentMonth.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await renderScreen();

    expect(screen.getByTestId('edit-recurring-expense-loading')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('pre-fills name and amount from route params, showing the amount by default with no "Amount" label and no due-date row visible yet', async () => {
    await renderScreen();

    expect(screen.getByTestId('recurring-name-input').props.value).toBe('Water');
    expect(screen.queryByText('Amount')).toBeNull();
    expect(screen.getByTestId('calculator-value').props.children).toBe('21.96');
    expect(screen.queryByTestId('due-day-value')).toBeNull();
  });

  it('pressing the calendar key swaps the display to the pre-filled due date, same as Add Transaction -- the amount is no longer shown', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(screen.queryByTestId('calculator-value')).toBeNull();
    expect(screen.getByTestId('due-day-value').props.children).toBe('10');
    expect(screen.getByTestId('due-month-year-value').props.children).toBe(' Sep 2026');
  });

  it('shows the pre-filled day in black (it is a real value, not a placeholder), and switches to gray once cleared', async () => {
    function flatten(style: unknown): Record<string, unknown>[] {
      return ([] as unknown[]).concat(style).filter(Boolean) as Record<string, unknown>[];
    }
    function colorOf(testId: string) {
      return flatten(screen.getByTestId(testId).props.style).find((s) => 'color' in s)?.color;
    }

    await renderScreen();
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    const monthYearColor = colorOf('due-month-year-value');
    // The pre-filled "10" is real data, not a placeholder -- same (black) color as the always-
    // black month/year.
    expect(colorOf('due-day-value')).toBe(monthYearColor);

    await fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(colorOf('due-day-value')).not.toBe(monthYearColor);
  });

  it('toggling back to amount mode restores the amount display', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(screen.getByTestId('calculator-value').props.children).toBe('21.96');
    expect(screen.queryByTestId('due-day-value')).toBeNull();
  });

  it('the Paid/Unpaid pill is a full-width banner, not a small round pill', async () => {
    function flatten(style: unknown): Record<string, unknown>[] {
      return ([] as unknown[]).concat(style).filter(Boolean) as Record<string, unknown>[];
    }

    await renderScreen();

    const pillStyle = flatten(screen.getByTestId('paid-pill').props.style);
    expect(pillStyle.some((s) => s.alignSelf === 'flex-start')).toBe(false);
    expect(pillStyle.some((s) => s.justifyContent === 'space-between')).toBe(true);
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

  it('lets the user edit name, category, due day, and amount, then saves via updateRecurringExpense with the newly-selected category\'s own derived budgetType', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('recurring-name-input'), 'Water Bill');
    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-housing'));
    // The very first digit pressed in day-entry mode replaces the pre-filled "10" outright
    // (same "start fresh on the first press" rule as the amount field below), landing on due
    // day 5, not 105.
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    // The first keypad press (now back in amount mode) clears the whole pre-filled amount and
    // starts fresh, so this ends up typing "50" from scratch -> 5000 cents, not 21.96 with a 5
    // and a 0 appended.
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

  it('has no Need/Want picker at all -- budgetType is derived from the selected category, not asked for', async () => {
    await renderScreen();

    expect(screen.queryByText('Need')).toBeNull();
    expect(screen.queryByText('Want')).toBeNull();
  });

  it('due day is not required to confirm -- unlike Add, Edit always has an existing value to fall back to', async () => {
    await renderScreen();

    // Name and amount are pre-filled valid already; nothing about the due day (still showing
    // its pre-filled "10", untouched) should block confirm.
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(false);
  });

  it('typing an invalid due day (0) and saving falls back to the original due day instead of sending 0', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ dueDay: 10 }));
  });

  it('rejects a second due-day digit that would push the day past the current month\'s real day count (September has 30, not 31)', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-3'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('3');
  });

  it('pressing delete on the pre-filled due day clears it to blank (placeholder), not a no-op', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('--');
  });

  it('pressing delete again once already blank keeps it blank, not an error', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('--');
  });

  it('typing a new due day after clearing it, then deleting again, also shows blank', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    expect(screen.getByTestId('due-day-value').props.children).toBe('5');

    await fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('--');
  });

  it('re-entering day-entry mode after typing (without confirming) shows what was typed, not the original pre-filled value', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-7'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(screen.getByTestId('due-day-value').props.children).toBe('7');
  });

  it('saving with the due day left blank (cleared, never re-typed) sends the original due day, silently, with no error', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ dueDay: 10 }));
    expect(screen.queryByText('Something went wrong. Please try again.')).toBeNull();
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
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

  it('does not cover the name field with the keyboard-dismiss overlay while it is focused (was interfering with typing)', async () => {
    await renderScreen();

    await fireEvent(screen.getByTestId('recurring-name-input'), 'focus');
    await act(async () => {
      keyboardDidShow();
    });

    expect(screen.queryByTestId('keyboard-dismiss-overlay')).toBeNull();

    await fireEvent(screen.getByTestId('recurring-name-input'), 'blur');

    expect(screen.getByTestId('keyboard-dismiss-overlay')).toBeTruthy();
  });
});
