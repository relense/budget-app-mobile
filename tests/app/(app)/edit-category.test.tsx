import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import {
  useRemoveCategoryFromMonth,
  useUpdateCategory,
  useUpdateCategoryMonthBudget,
} from '../../../src/api/categoryMutations';
import { useDeleteTransaction } from '../../../src/api/transactionMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import EditCategoryScreen from '../../../app/(app)/edit-category';

jest.mock('../../../src/api/categoryMutations');
jest.mock('../../../src/api/transactionMutations');
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
const mockedKeyboardDismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
const mockedAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedUseUpdateCategoryMonthBudget = useUpdateCategoryMonthBudget as jest.Mock;
const mockedUseUpdateCategory = useUpdateCategory as jest.Mock;
const mockedUseRemoveCategoryFromMonth = useRemoveCategoryFromMonth as jest.Mock;
const mockedUseDeleteTransaction = useDeleteTransaction as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const updateBudgetMutateAsync = jest.fn();
const updateCategoryMutateAsync = jest.fn();
const removeFromMonthMutateAsync = jest.fn();
const deleteTransactionMutateAsync = jest.fn();

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <EditCategoryScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseLocalSearchParams.mockReturnValue({
    categoryMonthId: 'cm-1',
    categoryId: 'c-1',
    name: 'Shopping',
    icon: 'cart',
    color: '#4C6EF5',
    budgetType: 'NEED',
    direction: 'EXPENSE',
    monthlyBudgetCents: '70000',
  });
  updateBudgetMutateAsync.mockResolvedValue(undefined);
  updateCategoryMutateAsync.mockResolvedValue(undefined);
  removeFromMonthMutateAsync.mockResolvedValue(undefined);
  mockedUseUpdateCategoryMonthBudget.mockReturnValue({
    mutateAsync: updateBudgetMutateAsync,
    isPending: false,
  });
  mockedUseUpdateCategory.mockReturnValue({
    mutateAsync: updateCategoryMutateAsync,
    isPending: false,
  });
  mockedUseRemoveCategoryFromMonth.mockReturnValue({
    mutateAsync: removeFromMonthMutateAsync,
    isPending: false,
  });
  deleteTransactionMutateAsync.mockResolvedValue(undefined);
  mockedUseDeleteTransaction.mockReturnValue({
    mutateAsync: deleteTransactionMutateAsync,
    isPending: false,
  });
});

describe('EditCategoryScreen', () => {
  it('pre-fills the amount from the current budget, with an editable name', async () => {
    await renderScreen();

    expect(screen.getByText('€700.00')).toBeTruthy();
    expect(screen.getByDisplayValue('Shopping').props.editable).not.toBe(false);
  });

  it('pressing a digit first replaces the pre-filled amount instead of silently doing nothing', async () => {
    // Regression test: the pre-filled amount always has 2 decimal digits already ("700.00"),
    // and appendDigit/appendDecimalPoint both refuse to append onto a string that already has
    // 2 decimals -- so without special-casing the very first press, every digit/decimal tap
    // was a silent no-op until backspace cleared past the decimal point first.
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-9'));

    expect(screen.getByText('€9')).toBeTruthy();
    expect(screen.queryByText('€700.00')).toBeNull();
  });

  it('pressing the decimal point first replaces the pre-filled amount too', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByText('€0.5')).toBeTruthy();
  });

  it('lets the user change the amount via the keypad and submits the new value', async () => {
    await renderScreen();

    // The first backspace clears the whole pre-filled value (same "start fresh on the first
    // press" rule as digits/decimal point), so this ends up typing "5" from scratch -> €5.00.
    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateBudgetMutateAsync).toHaveBeenCalledWith({
      categoryMonthId: 'cm-1',
      monthlyBudgetCents: 500,
    });
    expect(updateCategoryMutateAsync).not.toHaveBeenCalled();
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('also renames the category when the name field was changed, sending back every CategoryInput field', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Groceries');
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateCategoryMutateAsync).toHaveBeenCalledWith({
      categoryId: 'c-1',
      name: 'Groceries',
      icon: 'cart',
      color: '#CEF3C8',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    });
    expect(updateBudgetMutateAsync).toHaveBeenCalledWith({
      categoryMonthId: 'cm-1',
      monthlyBudgetCents: 70000,
    });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('disables Confirm once the name is cleared out entirely', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('category-name-input'), '   ');

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateCategoryMutateAsync).not.toHaveBeenCalled();
    expect(updateBudgetMutateAsync).not.toHaveBeenCalled();
  });

  it('shows a toast and does not navigate back when the budget save fails', async () => {
    updateBudgetMutateAsync.mockRejectedValue(new Error('network error'));
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting, and does nothing if the user cancels', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-category-button'));

    expect(mockedAlert).toHaveBeenCalledWith(
      'Delete category',
      expect.stringContaining('Shopping'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Delete' }),
      ]),
    );
    expect(removeFromMonthMutateAsync).not.toHaveBeenCalled();
  });

  it('removes the category from the month once the user confirms deletion, then navigates back', async () => {
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-category-button'));

    expect(removeFromMonthMutateAsync).toHaveBeenCalledWith({ categoryMonthId: 'cm-1' });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  describe('deleting an income category with a received transaction', () => {
    const incomeParams = {
      categoryMonthId: 'cm-salary',
      categoryId: 'c-salary',
      name: 'Salary',
      icon: 'briefcase',
      color: '#B8D8F0',
      budgetType: '',
      direction: 'INCOME',
      monthlyBudgetCents: '450000',
      recurringCommittedCents: '0',
      transactionIds: '["t-1","t-2"]',
    };

    it('deletes every linked transaction first, then the category, instead of being blocked', async () => {
      mockedUseLocalSearchParams.mockReturnValue(incomeParams);
      mockedAlert.mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((button) => button.text === 'Delete');
        deleteButton?.onPress?.();
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('delete-category-button'));

      expect(deleteTransactionMutateAsync).toHaveBeenCalledWith({ transactionId: 't-1' });
      expect(deleteTransactionMutateAsync).toHaveBeenCalledWith({ transactionId: 't-2' });
      expect(removeFromMonthMutateAsync).toHaveBeenCalledWith({ categoryMonthId: 'cm-salary' });
      expect(mockedRouterBack).toHaveBeenCalled();
    });

    it('shows a toast and does not attempt to delete the category if a transaction fails to delete', async () => {
      deleteTransactionMutateAsync.mockRejectedValue(new Error('network error'));
      mockedUseLocalSearchParams.mockReturnValue(incomeParams);
      mockedAlert.mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((button) => button.text === 'Delete');
        deleteButton?.onPress?.();
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('delete-category-button'));

      expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
      expect(removeFromMonthMutateAsync).not.toHaveBeenCalled();
      expect(mockedRouterBack).not.toHaveBeenCalled();
    });

    it('retries only the transactions that failed last time, not the ones already deleted', async () => {
      mockedUseLocalSearchParams.mockReturnValue(incomeParams);
      deleteTransactionMutateAsync.mockImplementation(
        ({ transactionId }: { transactionId: string }) =>
          transactionId === 't-2'
            ? Promise.reject(new Error('network error'))
            : Promise.resolve(undefined),
      );
      mockedAlert.mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((button) => button.text === 'Delete');
        deleteButton?.onPress?.();
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('delete-category-button'));

      expect(deleteTransactionMutateAsync).toHaveBeenCalledWith({ transactionId: 't-1' });
      expect(deleteTransactionMutateAsync).toHaveBeenCalledWith({ transactionId: 't-2' });
      expect(removeFromMonthMutateAsync).not.toHaveBeenCalled();

      // t-1 already succeeded last time; simulate t-2 now succeeding too on retry.
      deleteTransactionMutateAsync.mockClear();
      deleteTransactionMutateAsync.mockResolvedValue(undefined);

      await fireEvent.press(screen.getByTestId('delete-category-button'));

      // Only the previously-failed t-2 is retried -- re-sending the already-deleted t-1 would
      // just fail "not found" forever and leave this category permanently undeletable.
      expect(deleteTransactionMutateAsync).toHaveBeenCalledTimes(1);
      expect(deleteTransactionMutateAsync).toHaveBeenCalledWith({ transactionId: 't-2' });
      expect(removeFromMonthMutateAsync).toHaveBeenCalledWith({ categoryMonthId: 'cm-salary' });
      expect(mockedRouterBack).toHaveBeenCalled();
    });

    it('does not attempt any transaction deletion for an income category with no transactions', async () => {
      mockedUseLocalSearchParams.mockReturnValue({ ...incomeParams, transactionIds: '[]' });
      mockedAlert.mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((button) => button.text === 'Delete');
        deleteButton?.onPress?.();
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('delete-category-button'));

      expect(deleteTransactionMutateAsync).not.toHaveBeenCalled();
      expect(removeFromMonthMutateAsync).toHaveBeenCalledWith({ categoryMonthId: 'cm-salary' });
      expect(mockedRouterBack).toHaveBeenCalled();
    });

    it('does not delete transactions for an expense category even if transactionIds were somehow present', async () => {
      mockedUseLocalSearchParams.mockReturnValue({
        categoryMonthId: 'cm-1',
        categoryId: 'c-1',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
        recurringCommittedCents: '0',
        transactionIds: '["t-1"]',
      });
      mockedAlert.mockImplementation((_title, _message, buttons) => {
        const deleteButton = buttons?.find((button) => button.text === 'Delete');
        deleteButton?.onPress?.();
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('delete-category-button'));

      expect(deleteTransactionMutateAsync).not.toHaveBeenCalled();
      expect(removeFromMonthMutateAsync).toHaveBeenCalledWith({ categoryMonthId: 'cm-1' });
    });
  });

  it('shows a specific toast when deletion is blocked by existing transactions', async () => {
    removeFromMonthMutateAsync.mockRejectedValue({
      response: {
        errors: [{ message: 'nope', extensions: { code: 'CATEGORY_MONTH_HAS_TRANSACTIONS' } }],
      },
    });
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-category-button'));

    expect(
      await screen.findByText(
        'This category still has transactions or recurring expenses linked to it — delete those first.',
      ),
    ).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('shows the same specific toast when deletion is blocked by a linked recurring expense', async () => {
    removeFromMonthMutateAsync.mockRejectedValue({
      response: {
        errors: [
          { message: 'nope', extensions: { code: 'CATEGORY_MONTH_HAS_RECURRING_EXPENSES' } },
        ],
      },
    });
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-category-button'));

    expect(
      await screen.findByText(
        'This category still has transactions or recurring expenses linked to it — delete those first.',
      ),
    ).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('falls back to the generic toast for any other deletion failure', async () => {
    removeFromMonthMutateAsync.mockRejectedValue(new Error('network error'));
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-category-button'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('shows "Total budget" for an expense category and "Expected income" for an income category', async () => {
    await renderScreen();
    expect(screen.getByText('Total budget')).toBeTruthy();
    expect(screen.queryByText('Expected income')).toBeNull();

    mockedUseLocalSearchParams.mockReturnValue({
      categoryMonthId: 'cm-1',
      categoryId: 'c-2',
      name: 'Salary',
      icon: 'briefcase',
      color: '#B8D8F0',
      budgetType: null,
      direction: 'INCOME',
      monthlyBudgetCents: '70000',
    });
    await renderScreen();
    expect(screen.getByText('Expected income')).toBeTruthy();
  });

  it('opens the icon picker on icon-pill tap and updates the icon on selection', async () => {
    await renderScreen();

    expect(screen.queryByTestId('icon-picker-grid')).toBeNull();

    await fireEvent.press(screen.getByTestId('icon-pill'));
    expect(screen.getByTestId('icon-picker-grid')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('icon-option-home'));
    expect(screen.queryByTestId('icon-picker-grid')).toBeNull();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateCategoryMutateAsync).toHaveBeenCalledWith({
      categoryId: 'c-1',
      name: 'Shopping',
      icon: 'home',
      color: '#EEF3C8',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    });
  });

  it('offers only income icons for an income category, using the income palette color', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      categoryMonthId: 'cm-1',
      categoryId: 'c-2',
      name: 'Salary',
      icon: 'briefcase',
      color: '#B8D8F0',
      budgetType: null,
      direction: 'INCOME',
      monthlyBudgetCents: '70000',
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('icon-pill'));
    expect(screen.getByTestId('icon-option-briefcase')).toBeTruthy();
    expect(screen.getByTestId('icon-option-shield')).toBeTruthy();
    expect(screen.queryByTestId('icon-option-cart')).toBeNull();

    await fireEvent.press(screen.getByTestId('icon-option-shield'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateCategoryMutateAsync).toHaveBeenCalledWith({
      categoryId: 'c-2',
      name: 'Salary',
      icon: 'shield',
      color: '#F0C8D8',
      budgetType: null,
      direction: 'INCOME',
    });
  });

  it('does not resend CategoryInput when neither name nor icon changed', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateCategoryMutateAsync).not.toHaveBeenCalled();
    expect(updateBudgetMutateAsync).toHaveBeenCalled();
  });

  describe('recurring-expense minimum budget', () => {
    it('shows no hint and no floor when the category has no recurring expenses (recurringCommittedCents 0)', async () => {
      await renderScreen();

      expect(screen.queryByTestId('minimum-budget-hint')).toBeNull();
    });

    it('shows the minimum-budget hint in red when recurringCommittedCents is above 0', async () => {
      mockedUseLocalSearchParams.mockReturnValue({
        categoryMonthId: 'cm-1',
        categoryId: 'c-1',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
        recurringCommittedCents: '20000',
      });
      await renderScreen();

      const hint = screen.getByTestId('minimum-budget-hint');
      expect(hint.props.children.join('')).toContain('Minimum €200.00');
      const flatten = (style: unknown) => ([] as unknown[]).concat(style).filter(Boolean);
      const hintColor = (flatten(hint.props.style) as Record<string, unknown>[]).find(
        (s) => 'color' in s,
      )?.color;
      const deleteButtonColor = (
        flatten(screen.getByTestId('delete-category-button').props.style) as Record<
          string,
          unknown
        >[]
      ).find((s) => 'backgroundColor' in s)?.backgroundColor;
      expect(hintColor).toBe(deleteButtonColor);
    });

    it('clearing the amount shows the recurring-expense total as a gray placeholder, not "0"', async () => {
      mockedUseLocalSearchParams.mockReturnValue({
        categoryMonthId: 'cm-1',
        categoryId: 'c-1',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
        recurringCommittedCents: '20000',
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-backspace'));

      const amountValue = screen.getByTestId('amount-value');
      expect(amountValue.props.children).toBe('200.00');
      const flatten = (style: unknown) => ([] as unknown[]).concat(style).filter(Boolean);
      const color = (flatten(amountValue.props.style) as Record<string, unknown>[]).find(
        (s) => 'color' in s,
      )?.color;
      expect(color).not.toBeUndefined();
    });

    it('disables Confirm once the typed amount drops below the recurring-expense total', async () => {
      mockedUseLocalSearchParams.mockReturnValue({
        categoryMonthId: 'cm-1',
        categoryId: 'c-1',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
        recurringCommittedCents: '20000',
      });
      await renderScreen();

      // First backspace clears the pre-filled amount to blank (still valid -- effective value
      // falls back to the minimum itself); typing "5" from scratch lands on 5 cents, well below
      // the 20000-cent minimum.
      await fireEvent.press(screen.getByTestId('keypad-backspace'));
      expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(false);

      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);
    });

    it('confirming while the amount is left blank submits the recurring-expense total itself, not 0', async () => {
      mockedUseLocalSearchParams.mockReturnValue({
        categoryMonthId: 'cm-1',
        categoryId: 'c-1',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
        recurringCommittedCents: '20000',
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-backspace'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(updateBudgetMutateAsync).toHaveBeenCalledWith({
        categoryMonthId: 'cm-1',
        monthlyBudgetCents: 20000,
      });
      expect(mockedRouterBack).toHaveBeenCalled();
    });

    it('allows submitting a typed amount at or above the minimum', async () => {
      mockedUseLocalSearchParams.mockReturnValue({
        categoryMonthId: 'cm-1',
        categoryId: 'c-1',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
        recurringCommittedCents: '20000',
      });
      await renderScreen();

      // "250" with no decimal point -> amountTextToCents parses it as €250.00 = 25000 cents,
      // above the 20000-cent (€200.00) minimum.
      await fireEvent.press(screen.getByTestId('keypad-backspace'));
      await fireEvent.press(screen.getByTestId('keypad-digit-2'));
      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      await fireEvent.press(screen.getByTestId('keypad-digit-0'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(updateBudgetMutateAsync).toHaveBeenCalledWith({
        categoryMonthId: 'cm-1',
        monthlyBudgetCents: 25000,
      });
      expect(mockedRouterBack).toHaveBeenCalled();
    });
  });

  it('swallows the first tap outside the keyboard instead of also pressing what is underneath', async () => {
    await renderScreen();

    await act(async () => {
      keyboardDidShow();
    });
    expect(screen.getByTestId('keyboard-dismiss-overlay')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('keyboard-dismiss-overlay'));
    expect(mockedKeyboardDismiss).toHaveBeenCalled();

    await act(async () => {
      keyboardDidHide();
    });
    expect(screen.queryByTestId('keyboard-dismiss-overlay')).toBeNull();
  });
});
