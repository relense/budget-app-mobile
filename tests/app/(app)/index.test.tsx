import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import {
  useBankBalance,
  useCategoryMonths,
  useCurrentMonth,
  useRecurringExpenses,
  useTransactions,
} from '../../../src/api/budgetHomeQueries';
import { useAuth } from '../../../src/auth/AuthContext';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import HomeScreen from '../../../app/(app)/index';

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/auth/AuthContext');

// HomeScreen is rendered directly here, outside a real NavigationContainer, so the
// context-based `useNavigation` hook has nothing to attach to -- stub it with a no-op listener
// the same way `router.push` below is stubbed rather than exercised for real.
const mockedAddListener = jest.fn<() => void, [event: string, callback: () => void]>(
  () => jest.fn(),
);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useNavigation: () => ({ addListener: mockedAddListener }),
}));

// SwipeableRow's own drag/gesture behavior is covered directly in its own test file --
// here we only care that HomeScreen wires it up (testID/onEdit) and remounts it on focus, so
// it's replaced with a passthrough that preserves that same testID/onPress contract while
// recording each mount so the focus-triggered remount below is actually observable.
const mockSwipeableRowMount = jest.fn();
jest.mock('../../../src/components/SwipeableRow', () => {
  const ReactActual = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return {
    SwipeableRow: ({ onEdit, testID, children }: any) => {
      ReactActual.useEffect(() => {
        mockSwipeableRowMount();
      }, []);
      return ReactActual.createElement(Pressable, { testID, onPress: onEdit }, children);
    },
  };
});

const mockedRouterPush = jest.spyOn(router, 'push').mockImplementation(() => {});

const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
const mockedUseCategoryMonths = useCategoryMonths as jest.Mock;
const mockedUseRecurringExpenses = useRecurringExpenses as jest.Mock;
const mockedUseTransactions = useTransactions as jest.Mock;
const mockedUseBankBalance = useBankBalance as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockSignOut = jest.fn();

const idle = { data: undefined, isLoading: false, isError: false, refetch: jest.fn() };

const expenseCategoryMonths = [
  {
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
  },
  {
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
  },
];

const incomeCategoryMonths = [
  {
    id: 'cm-obconnect',
    month: '2026-09',
    monthlyBudgetCents: 430000,
    actualAmountCents: 368600,
    recurringCommittedCents: 0,
    category: {
      id: 'c-obconnect',
      name: 'Obconnect',
      icon: 'briefcase',
      color: '#2F9E44',
      budgetType: null,
      direction: 'INCOME',
    },
    transactions: [{ date: '2026-09-01' }],
  },
];

const recurringExpenses = [
  {
    id: 're-water',
    month: '2026-09',
    name: 'Water',
    amountCents: 2196,
    budgetType: 'NEED',
    dueDay: 10,
    paidThisMonth: false,
    category: {
      id: 'c-shopping',
      name: 'Shopping',
      icon: 'cart',
      color: '#4C6EF5',
      budgetType: 'NEED',
      direction: 'EXPENSE',
    },
    transactions: [],
  },
];

const transactions = [
  {
    id: 't-continente',
    amountCents: 968,
    date: '2026-09-02',
    merchant: 'Continente',
    note: null,
    direction: 'EXPENSE',
    categoryMonth: {
      id: 'cm-shopping',
      monthlyBudgetCents: 70000,
      actualAmountCents: 19420,
      category: {
        id: 'c-shopping',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
      },
    },
  },
];

function renderHomeScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ signOut: mockSignOut });
  mockedUseCurrentMonth.mockReturnValue({ ...idle, data: { month: '2026-09', locked: false } });
  mockedUseCategoryMonths.mockImplementation((_month: string, direction: string) => ({
    ...idle,
    data: direction === 'EXPENSE' ? expenseCategoryMonths : incomeCategoryMonths,
  }));
  mockedUseRecurringExpenses.mockReturnValue({ ...idle, data: recurringExpenses });
  mockedUseTransactions.mockReturnValue({ ...idle, data: transactions });
  mockedUseBankBalance.mockReturnValue({
    ...idle,
    data: {
      amountCents: 28287,
      checkpointAmountCents: 0,
      checkpointSetAt: '2026-01-01T00:00:00.000Z',
    },
  });
});

describe('HomeScreen', () => {
  it('shows the Available Budgeted total and the current month by default', async () => {
    await renderHomeScreen();

    expect(screen.getByText('Available Budgeted')).toBeTruthy();
    expect(screen.getByText('September')).toBeTruthy();
    // (70000 - 19420) + (20000 - 5000) = 65580 cents
    expect(screen.getByText('€655.80')).toBeTruthy();
  });

  it('shows expense categories on the Available tab, with the "new" row', async () => {
    await renderHomeScreen();

    expect(screen.getByText('New budget category')).toBeTruthy();
    expect(screen.getByText('Shopping')).toBeTruthy();
    expect(screen.getByText('Eating Out')).toBeTruthy();
    // The "Available" tab label itself, plus one "Available" subtitle per row (2 categories).
    expect(screen.getAllByText('Available')).toHaveLength(3);
  });

  it('navigates to Add Category when "New budget category" is pressed', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('New budget category'));

    expect(mockedRouterPush).toHaveBeenCalledWith('/add-category');
  });

  it('navigates to Add Transaction when the bottom-nav + is pressed', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByTestId('add-transaction-button'));

    expect(mockedRouterPush).toHaveBeenCalledWith('/add-transaction');
  });

  it('navigates to Edit Category, with the right params, when a row is swipe-edited', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByTestId('swipe-edit-action-cm-shopping'));

    expect(mockedRouterPush).toHaveBeenCalledWith({
      pathname: '/edit-category',
      params: {
        categoryMonthId: 'cm-shopping',
        categoryId: 'c-shopping',
        name: 'Shopping',
        icon: 'cart',
        color: '#4C6EF5',
        budgetType: 'NEED',
        direction: 'EXPENSE',
        monthlyBudgetCents: '70000',
      },
    });
  });

  it('switches to the Expenses tab and shows transactions with merchant names', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Expenses'));

    expect(screen.getByText('Continente')).toBeTruthy();
    expect(screen.queryByText('New budget category')).toBeNull();
  });

  it('navigates to Edit Transaction, with the right params, when an Expenses row is swipe-edited', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Expenses'));
    await fireEvent.press(screen.getByTestId('swipe-edit-action-t-continente'));

    expect(mockedRouterPush).toHaveBeenCalledWith({
      pathname: '/edit-transaction',
      params: {
        transactionId: 't-continente',
        categoryMonthId: 'cm-shopping',
        amountCents: '968',
        date: '2026-09-02',
        merchant: 'Continente',
      },
    });
  });

  it('shows the category\'s cumulative spend percentage on an Expenses row, not just this one transaction\'s own share', async () => {
    // Regression test: this transaction is only 968/70000 = 1% of the budget on its own, but
    // the category (per categoryMonth.actualAmountCents) has spent 19420/70000 = 28% overall --
    // the row must reflect the latter, so a category that's actually over budget shows over
    // 100% instead of a misleadingly small single-transaction ratio.
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Expenses'));

    expect(screen.getByText('28%')).toBeTruthy();
    expect(screen.queryByText('1%')).toBeNull();
  });

  it('switches to the Recurrent tab and shows the "new" row plus bills', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Recurrent'));

    expect(screen.getByText('New recurrent expense')).toBeTruthy();
    expect(screen.getByText('Water')).toBeTruthy();
    expect(screen.getByText('Unpaid')).toBeTruthy();
  });

  it('switches to the Income tab and shows both actual and expected amounts', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Income'));

    expect(screen.getByText('New income')).toBeTruthy();
    expect(screen.getByText('Obconnect')).toBeTruthy();
    expect(screen.getByText('€3,686.00')).toBeTruthy();
    expect(screen.getByText('€4,300.00')).toBeTruthy();
  });

  it('opens the header metric menu and switches to Total Balance', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Available Budgeted'));
    await fireEvent.press(screen.getByText('Total Balance'));

    expect(screen.getByText('Total Balance')).toBeTruthy();
    expect(screen.getByText('€282.87')).toBeTruthy();
  });

  it('closes the header metric menu when tapping outside it, without changing the metric', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Available Budgeted'));
    expect(screen.getByText('Total Balance')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('header-metric-menu-backdrop'));

    expect(screen.queryByText('Total Balance')).toBeNull();
    expect(screen.getByText('Available Budgeted')).toBeTruthy();
  });

  it('signs out when the profile icon is pressed', async () => {
    await renderHomeScreen();

    await fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('shows a spinner in the list area while the current month is loading, keeping the header/tabs/nav visible', async () => {
    mockedUseCurrentMonth.mockReturnValue({ ...idle, isLoading: true });
    await renderHomeScreen();

    expect(screen.getByTestId('home-body-spinner')).toBeTruthy();
    expect(screen.getByText('Available Budgeted')).toBeTruthy();
    expect(screen.getByTestId('add-transaction-button')).toBeTruthy();
    expect(screen.queryByText('Shopping')).toBeNull();
  });

  it('shows a specific, retryable error in the list area when the current month fails to load, keeping the rest of the dashboard usable', async () => {
    mockedUseCurrentMonth.mockReturnValue({ ...idle, isError: true });
    await renderHomeScreen();

    expect(screen.getByTestId('home-body-error')).toBeTruthy();
    expect(screen.getByText("Couldn't load your budget for this month.")).toBeTruthy();
    // The rest of the shell -- header, tabs, bottom nav -- stays usable instead of the whole
    // screen being replaced by the error.
    expect(screen.getByText('Available Budgeted')).toBeTruthy();
    expect(screen.getByTestId('sign-out-button')).toBeTruthy();
  });

  it('retries the current-month fetch when Try again is pressed after it fails', async () => {
    const refetch = jest.fn();
    mockedUseCurrentMonth.mockReturnValue({ ...idle, isError: true, refetch });
    await renderHomeScreen();

    await fireEvent.press(screen.getByTestId('retry-button'));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows a tab-specific, retryable error when a tab body query fails (current month already loaded)', async () => {
    const refetch = jest.fn();
    mockedUseTransactions.mockReturnValue({ ...idle, isError: true, refetch });
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Expenses'));

    expect(screen.getByText("Couldn't load your transactions.")).toBeTruthy();

    await fireEvent.press(screen.getByTestId('retry-button'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner in place of the header amount while its backing query is loading', async () => {
    mockedUseCategoryMonths.mockImplementation((_month: string, direction: string) =>
      direction === 'EXPENSE'
        ? { data: undefined, isLoading: true, isError: false }
        : { ...idle, data: incomeCategoryMonths },
    );
    await renderHomeScreen();

    expect(screen.getByTestId('header-amount-spinner')).toBeTruthy();
    expect(screen.queryByText('€655.80')).toBeNull();
  });

  it('shows an error placeholder in the header instead of a misleading €0.00', async () => {
    mockedUseBankBalance.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    await renderHomeScreen();

    await fireEvent.press(screen.getByText('Available Budgeted'));
    await fireEvent.press(screen.getByText('Total Balance'));

    expect(screen.getByTestId('header-amount-error')).toBeTruthy();
    expect(screen.queryByText('€0.00')).toBeNull();
  });

  it('remounts the category rows when the screen regains focus, so a swiped-open row resets', async () => {
    await renderHomeScreen();

    expect(mockedAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
    const onFocus = mockedAddListener.mock.calls[0][1];
    const mountsBeforeFocus = mockSwipeableRowMount.mock.calls.length;
    // Two expense categories (Shopping, Eating Out) are rendered as SwipeableRow on the
    // Available tab.
    expect(mountsBeforeFocus).toBe(2);

    await act(async () => {
      onFocus();
    });

    // Each row's `key` changes on focus, so React tears down and remounts every row instead of
    // just re-rendering it -- that's what resets a swiped-open row without an animated close.
    expect(mockSwipeableRowMount.mock.calls.length).toBe(mountsBeforeFocus * 2);
  });
});
