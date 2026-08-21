import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCategoryMonths, useCurrentMonth } from '../../../src/api/budgetHomeQueries';
import {
  useDeleteTransaction,
  useUpdateTransaction,
} from '../../../src/api/transactionMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import EditTransactionScreen from '../../../app/(app)/edit-transaction';

jest.mock('../../../src/api/budgetHomeQueries');
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
const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
const mockedUseCategoryMonths = useCategoryMonths as jest.Mock;
const mockedUseUpdateTransaction = useUpdateTransaction as jest.Mock;
const mockedUseDeleteTransaction = useDeleteTransaction as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const updateMutateAsync = jest.fn();
const deleteMutateAsync = jest.fn();

const shoppingCategoryMonth = {
  id: 'cm-1',
  month: '2026-09',
  monthlyBudgetCents: 70000,
  actualAmountCents: 19420,
  recurringCommittedCents: 0,
  category: {
    id: 'c-shopping',
    name: 'Shopping',
    icon: 'cart',
    color: '#4C6EF5',
    budgetType: 'NEED',
    direction: 'EXPENSE',
  },
  transactions: [],
};

const eatingOutCategoryMonth = {
  id: 'cm-2',
  month: '2026-09',
  monthlyBudgetCents: 20000,
  actualAmountCents: 5000,
  recurringCommittedCents: 0,
  category: {
    id: 'c-eating-out',
    name: 'Eating Out',
    icon: 'utensils',
    color: '#F76707',
    budgetType: 'WANT',
    direction: 'EXPENSE',
  },
  transactions: [],
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <EditTransactionScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseLocalSearchParams.mockReturnValue({
    transactionId: 't-1',
    categoryMonthId: 'cm-1',
    amountCents: '968',
    date: '2026-09-02',
    merchant: 'Continente',
  });
  mockedUseCurrentMonth.mockReturnValue({
    data: { month: '2026-09', locked: false },
    isLoading: false,
    isError: false,
  });
  mockedUseCategoryMonths.mockReturnValue({
    data: [shoppingCategoryMonth, eatingOutCategoryMonth],
    isLoading: false,
    isError: false,
  });
  updateMutateAsync.mockResolvedValue(undefined);
  deleteMutateAsync.mockResolvedValue(undefined);
  mockedUseUpdateTransaction.mockReturnValue({ mutateAsync: updateMutateAsync, isPending: false });
  mockedUseDeleteTransaction.mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false });
});

describe('EditTransactionScreen', () => {
  it('shows a loading state while the current month is loading', async () => {
    mockedUseCurrentMonth.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await renderScreen();

    expect(screen.getByTestId('edit-transaction-loading')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('shows an error state when the category months fetch fails', async () => {
    mockedUseCategoryMonths.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    await renderScreen();

    expect(screen.getByTestId('edit-transaction-error')).toBeTruthy();
  });

  it('pre-fills the amount and merchant, showing the transaction\'s current category', async () => {
    await renderScreen();

    expect(screen.getByText('€9.68')).toBeTruthy();
    expect(screen.getByDisplayValue('Continente')).toBeTruthy();
    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('pressing a digit first replaces the pre-filled amount instead of appending to it', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByText('€5')).toBeTruthy();
    expect(screen.queryByText('€9.68')).toBeNull();
  });

  it('submits the changed amount, keeping the category and date unchanged', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      transactionId: 't-1',
      categoryMonthId: 'cm-1',
      amountCents: 500,
      date: '2026-09-02',
      merchant: 'Continente',
    });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('opens the category picker and switches to a different category, submitting its categoryMonthId', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-eating-out'));

    expect(screen.getByText('Eating Out')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ categoryMonthId: 'cm-2' }),
    );
  });

  it('dismisses the category picker when tapping outside it, without changing the selection', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('category-picker-backdrop'));

    expect(screen.queryByTestId('existing-category-c-eating-out')).toBeNull();
    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('submits an edited merchant, and null when cleared out entirely', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('transaction-merchant-input'), 'Auchan');
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ merchant: 'Auchan' }),
    );
  });

  it('sends a null merchant when cleared out entirely', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('transaction-merchant-input'), '   ');
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ merchant: null }));
  });

  it('disables Confirm once the amount is cleared out to zero', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));
    await fireEvent.press(screen.getByTestId('keypad-backspace'));

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(true);
  });

  it('lets the day be changed via the keypad date mode (month/year fixed) and submits the new value', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-2'));
    await fireEvent.press(screen.getByTestId('keypad-digit-1'));
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-09-21' }),
    );
  });

  it('rejects a day digit that would exceed how many days this month actually has', async () => {
    await renderScreen();

    // September has 30 days -- "35" is never a real day here.
    await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
    await fireEvent.press(screen.getByTestId('keypad-digit-3'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByTestId('calculator-value').props.children).toBe('3 Sep 2026');
  });

  it('shows an error and does not navigate back when the update fails', async () => {
    updateMutateAsync.mockRejectedValue(new Error('network error'));
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting, and does nothing if the user cancels', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-transaction-button'));

    expect(mockedAlert).toHaveBeenCalledWith(
      'Delete transaction',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Delete' }),
      ]),
    );
    expect(deleteMutateAsync).not.toHaveBeenCalled();
  });

  it('deletes the transaction once confirmed, then navigates back', async () => {
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-transaction-button'));

    expect(deleteMutateAsync).toHaveBeenCalledWith({ transactionId: 't-1' });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('shows an error when the confirmed deletion fails', async () => {
    deleteMutateAsync.mockRejectedValue(new Error('network error'));
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-transaction-button'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
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
