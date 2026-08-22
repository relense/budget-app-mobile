import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCreateTransaction, useDeleteTransaction } from '../../../src/api/transactionMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import IncomeReceivedScreen from '../../../app/(app)/income-received';

jest.mock('../../../src/api/transactionMutations');
jest.mock('../../../src/lib/today', () => ({
  todayIsoDate: () => '2026-09-15',
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const mockedUseCreateTransaction = useCreateTransaction as jest.Mock;
const mockedUseDeleteTransaction = useDeleteTransaction as jest.Mock;
const mockedUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const createMutateAsync = jest.fn();
const deleteMutateAsync = jest.fn();

const notReceivedParams = {
  categoryMonthId: 'cm-obconnect',
  name: 'Obconnect',
  icon: 'briefcase',
  color: '#B8D8F0',
  monthlyBudgetCents: '430000',
  actualAmountCents: '0',
  transactionIds: '[]',
};

const receivedParams = {
  ...notReceivedParams,
  actualAmountCents: '430000',
  transactionIds: '["t-1"]',
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <IncomeReceivedScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseLocalSearchParams.mockReturnValue(notReceivedParams);
  createMutateAsync.mockResolvedValue(undefined);
  deleteMutateAsync.mockResolvedValue(undefined);
  mockedUseCreateTransaction.mockReturnValue({ mutateAsync: createMutateAsync, isPending: false });
  mockedUseDeleteTransaction.mockReturnValue({ mutateAsync: deleteMutateAsync, isPending: false });
});

describe('IncomeReceivedScreen', () => {
  it('pre-fills the amount with the expected monthly amount', async () => {
    await renderScreen();

    expect(screen.getByText('4300.00')).toBeTruthy();
  });

  it('shows "Not received" when actualAmountCents is 0', async () => {
    await renderScreen();

    expect(screen.getByText('Not received')).toBeTruthy();
  });

  it('shows "Received" when actualAmountCents is greater than 0', async () => {
    mockedUseLocalSearchParams.mockReturnValue(receivedParams);

    await renderScreen();

    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('confirm creates a transaction for the shown amount, dated today, and navigates back', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      categoryMonthId: 'cm-obconnect',
      amountCents: 430000,
      date: '2026-09-15',
      merchant: null,
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('editing the amount before confirming sends the edited value, not the pre-filled expected amount', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 5000 }),
    );
  });

  it('tapping the pill while Not received also records the shown amount', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('received-pill'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      categoryMonthId: 'cm-obconnect',
      amountCents: 430000,
      date: '2026-09-15',
      merchant: null,
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('tapping the pill while Received deletes every linked transaction instead of creating one', async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      ...receivedParams,
      transactionIds: '["t-1","t-2"]',
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('received-pill'));

    expect(deleteMutateAsync).toHaveBeenCalledWith({ transactionId: 't-1' });
    expect(deleteMutateAsync).toHaveBeenCalledWith({ transactionId: 't-2' });
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('shows a toast and does not navigate back when creating the transaction fails', async () => {
    createMutateAsync.mockRejectedValue(new Error('network error'));

    await renderScreen();
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('disables confirm when the amount is 0', async () => {
    mockedUseLocalSearchParams.mockReturnValue({ ...notReceivedParams, monthlyBudgetCents: '0' });

    await renderScreen();

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(true);
  });
});
