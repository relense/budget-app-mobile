import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCategoryMonths, useCurrentMonth } from '../../../src/api/budgetHomeQueries';
import { useCreateTransaction } from '../../../src/api/transactionMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import AddTransactionScreen from '../../../app/(app)/add-transaction';

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/api/transactionMutations');
jest.mock('../../../src/lib/today', () => ({
  todayIsoDate: () => '2026-09-02',
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
const mockedUseCategoryMonths = useCategoryMonths as jest.Mock;
const mockedUseCreateTransaction = useCreateTransaction as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const createMutateAsync = jest.fn();

const shoppingCategoryMonth = {
  id: 'cm-shopping',
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
  id: 'cm-eating-out',
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
        <AddTransactionScreen />
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
  });
  mockedUseCategoryMonths.mockReturnValue({
    data: [shoppingCategoryMonth, eatingOutCategoryMonth],
    isLoading: false,
    isError: false,
  });
  createMutateAsync.mockResolvedValue(undefined);
  mockedUseCreateTransaction.mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
    isError: false,
  });
});

describe('AddTransactionScreen', () => {
  it('shows a loading state while the current month is loading', async () => {
    mockedUseCurrentMonth.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-loading')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('shows an error state when the current month fails to load', async () => {
    mockedUseCurrentMonth.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-error')).toBeTruthy();
  });

  it('shows an error state when the category months fetch fails', async () => {
    mockedUseCategoryMonths.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-error')).toBeTruthy();
  });

  it('shows an empty state instead of a broken picker when no expense categories are active this month', async () => {
    mockedUseCategoryMonths.mockReturnValue({ data: [], isLoading: false, isError: false });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-empty')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('preselects the first active expense category', async () => {
    await renderScreen();

    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('renders the category pill label in Fredoka regular', async () => {
    await renderScreen();

    const style = ([] as unknown[])
      .concat(screen.getByText('Shopping').props.style)
      .filter(Boolean) as Record<string, unknown>[];
    expect(style.some((s) => s.fontFamily === 'Fredoka_400Regular')).toBe(true);
  });

  it('renders the description input at size 14', async () => {
    await renderScreen();

    const style = ([] as unknown[])
      .concat(screen.getByTestId('transaction-merchant-input').props.style)
      .filter(Boolean) as Record<string, unknown>[];
    expect(style.some((s) => s.fontSize === 14)).toBe(true);
  });

  it('opens the category picker, switching the selected category', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-eating-out'));

    expect(screen.getByText('Eating Out')).toBeTruthy();
    expect(screen.queryByTestId('existing-category-c-shopping')).toBeNull();
  });

  it('dismisses the category picker when tapping outside it, without changing the selection', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('category-picker-backdrop'));

    expect(screen.queryByTestId('existing-category-c-eating-out')).toBeNull();
    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('starts with the confirm key disabled until an amount is entered', async () => {
    await renderScreen();

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(false);
  });

  it('builds up the amount from keypad presses', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-9'));
    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-6'));
    await fireEvent.press(screen.getByTestId('keypad-digit-8'));

    expect(screen.getByText('€9.68')).toBeTruthy();
  });

  it('submits the transaction with the merchant typed, defaulting the date to today', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('transaction-merchant-input'), 'Continente');
    await fireEvent.press(screen.getByTestId('keypad-digit-9'));
    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-6'));
    await fireEvent.press(screen.getByTestId('keypad-digit-8'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      categoryMonthId: 'cm-shopping',
      amountCents: 968,
      date: '2026-09-02',
      merchant: 'Continente',
    });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('sends a null merchant, falling back to the category name on the Expenses list, when left blank', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ merchant: null }),
    );
  });

  it('shows an error message and does not navigate back when the mutation fails', async () => {
    createMutateAsync.mockRejectedValue(new Error('network error'));
    mockedUseCreateTransaction.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
      isError: true,
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  describe('date entry mode', () => {
    it('switches the amount display to the typed day, defaulting to today, with month/year fixed', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

      // Not getByText: a short typed day can collide with a keypad digit key's own label
      // (e.g. "2"), so assert on the display node directly instead.
      expect(screen.getByTestId('calculator-value').props.children).toBe('2 Sep 2026');
      expect(screen.queryByText('€0')).toBeNull();
    });

    it('replaces the day from scratch as soon as the first digit is typed, keeping month/year fixed', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
      await fireEvent.press(screen.getByTestId('keypad-digit-2'));
      await fireEvent.press(screen.getByTestId('keypad-digit-1'));

      expect(screen.getByTestId('calculator-value').props.children).toBe('21 Sep 2026');
    });

    it('commits the typed day and uses it (with the fixed month/year) once back in amount mode', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
      await fireEvent.press(screen.getByTestId('keypad-digit-2'));
      await fireEvent.press(screen.getByTestId('keypad-digit-1'));
      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

      expect(screen.getByText('€0')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-09-21' }),
      );
    });

    it('keeps the previous date unchanged if no digit was typed before leaving date mode', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));

      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-09-02' }),
      );
    });

    it('backspaces the typed day digit by digit', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
      await fireEvent.press(screen.getByTestId('keypad-digit-2'));
      await fireEvent.press(screen.getByTestId('keypad-digit-1'));
      await fireEvent.press(screen.getByTestId('keypad-backspace'));

      expect(screen.getByTestId('calculator-value').props.children).toBe('2 Sep 2026');
    });

    it('rejects a second digit that would push the day past how many days this month actually has', async () => {
      await renderScreen();

      // September has 30 days -- "35" is never a real day here.
      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
      await fireEvent.press(screen.getByTestId('keypad-digit-3'));
      await fireEvent.press(screen.getByTestId('keypad-digit-5'));

      expect(screen.getByTestId('calculator-value').props.children).toBe('3 Sep 2026');
    });
  });
});
