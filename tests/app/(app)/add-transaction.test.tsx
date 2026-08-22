import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import {
  useCategoryMonths,
  useCurrentMonth,
  useTransactions,
} from '../../../src/api/budgetHomeQueries';
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
const mockedUseTransactions = useTransactions as jest.Mock;
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
    refetch: jest.fn(),
  });
  mockedUseCategoryMonths.mockReturnValue({
    data: [shoppingCategoryMonth, eatingOutCategoryMonth],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockedUseTransactions.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
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

  it('shows a loading state while transactions are still loading, even though the month and categories are ready', async () => {
    // The category pill's default depends on transactionsQuery.data -- rendering the form
    // before it resolves would show the wrong default pill for a moment.
    mockedUseTransactions.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-loading')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('shows a specific, retryable error when the current month fails to load', async () => {
    const refetchMonth = jest.fn();
    const refetchCategoryMonths = jest.fn();
    mockedUseCurrentMonth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMonth,
    });
    mockedUseCategoryMonths.mockReturnValue({
      data: [shoppingCategoryMonth, eatingOutCategoryMonth],
      isLoading: false,
      isError: false,
      refetch: refetchCategoryMonths,
    });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-error')).toBeTruthy();
    expect(
      screen.getByText("Couldn't load your budget categories for this transaction."),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('retry-button'));

    expect(refetchMonth).toHaveBeenCalledTimes(1);
    // expenseCategoryMonths is gated on `month` being known -- since the month fetch itself
    // failed, there's no month to scope a category-months refetch to yet.
    expect(refetchCategoryMonths).not.toHaveBeenCalled();
  });

  it('shows a specific, retryable error when the category months fetch fails', async () => {
    mockedUseCategoryMonths.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-error')).toBeTruthy();
    expect(
      screen.getByText("Couldn't load your budget categories for this transaction."),
    ).toBeTruthy();
  });

  it('shows an empty state instead of a broken picker when no expense categories are active this month', async () => {
    mockedUseCategoryMonths.mockReturnValue({ data: [], isLoading: false, isError: false });

    await renderScreen();

    expect(screen.getByTestId('add-transaction-empty')).toBeTruthy();
    expect(screen.queryByTestId('keypad-confirm')).toBeNull();
  });

  it('preselects the first active expense category when no transactions exist yet this month', async () => {
    await renderScreen();

    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('preselects the category used by the most recently dated transaction this month, over the first-in-list default', async () => {
    mockedUseTransactions.mockReturnValue({
      // transactions(month) is ordered date DESC, createdAt DESC -- date is the primary key, so
      // [0] here is 't-2' (dated 09-02, the later date), not necessarily whichever was entered
      // most recently. Fixture ordering matches that real contract, not creation order.
      data: [
        {
          id: 't-2',
          amountCents: 1200,
          date: '2026-09-02',
          merchant: 'Cafe',
          note: null,
          direction: 'EXPENSE',
          categoryMonth: eatingOutCategoryMonth,
        },
        {
          id: 't-1',
          amountCents: 968,
          date: '2026-09-01',
          merchant: 'Continente',
          note: null,
          direction: 'EXPENSE',
          categoryMonth: shoppingCategoryMonth,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByText('Eating Out')).toBeTruthy();
  });

  it('falls back to the first active expense category if the most recently dated transaction\'s category is no longer active this month', async () => {
    mockedUseTransactions.mockReturnValue({
      data: [
        {
          id: 't-1',
          amountCents: 500,
          date: '2026-09-01',
          merchant: 'Gone',
          note: null,
          direction: 'EXPENSE',
          categoryMonth: { ...eatingOutCategoryMonth, id: 'cm-removed' },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByText('Shopping')).toBeTruthy();
  });

  it('skips past a more-recently-dated income transaction to find the last expense category, since this screen only creates expenses', async () => {
    mockedUseTransactions.mockReturnValue({
      data: [
        {
          id: 't-income',
          amountCents: 300000,
          date: '2026-09-02',
          merchant: 'Salary',
          note: null,
          direction: 'INCOME',
          categoryMonth: {
            id: 'cm-salary',
            monthlyBudgetCents: 300000,
            actualAmountCents: 300000,
            category: {
              id: 'c-salary',
              name: 'Salary',
              icon: 'briefcase',
              color: '#2F9E44',
              budgetType: null,
              direction: 'INCOME',
            },
          },
        },
        {
          id: 't-expense',
          amountCents: 500,
          date: '2026-09-01',
          merchant: 'Cafe',
          note: null,
          direction: 'EXPENSE',
          categoryMonth: eatingOutCategoryMonth,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByText('Eating Out')).toBeTruthy();
  });

  it('still lets the user pick a different category, overriding the recently-dated-transaction default', async () => {
    mockedUseTransactions.mockReturnValue({
      data: [
        {
          id: 't-1',
          amountCents: 968,
          date: '2026-09-02',
          merchant: 'Continente',
          note: null,
          direction: 'EXPENSE',
          categoryMonth: shoppingCategoryMonth,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();
    expect(screen.getByText('Shopping')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('category-pill'));
    await fireEvent.press(screen.getByTestId('existing-category-c-eating-out'));

    expect(screen.getByText('Eating Out')).toBeTruthy();
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

    it('commits the still-typed day if Confirm is pressed without leaving date mode first', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      await fireEvent.press(screen.getByTestId('keypad-toggle-date'));
      await fireEvent.press(screen.getByTestId('keypad-digit-2'));
      await fireEvent.press(screen.getByTestId('keypad-digit-1'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-09-21' }),
      );
    });
  });

  it("falls back to the 1st of the active month when today's real date falls outside it", async () => {
    mockedUseCurrentMonth.mockReturnValue({
      data: { month: '2026-08', locked: false },
      isLoading: false,
      isError: false,
    });
    mockedUseCategoryMonths.mockReturnValue({
      data: [{ ...shoppingCategoryMonth, month: '2026-08' }],
      isLoading: false,
      isError: false,
    });

    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-08-01' }),
    );
  });
});
