import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCurrentMonth } from '../../../src/api/budgetHomeQueries';
import { useCreateCategoryWithBudget } from '../../../src/api/categoryMutations';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import AddCategoryScreen from '../../../app/(app)/add-category';

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/api/categoryMutations');
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

let keyboardDidShow: () => void = () => {};
let keyboardDidHide: () => void = () => {};

jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
  if (event === 'keyboardDidShow') keyboardDidShow = callback as () => void;
  if (event === 'keyboardDidHide') keyboardDidHide = callback as () => void;
  return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
});
const mockedKeyboardDismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});

const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
const mockedUseCreateCategoryWithBudget = useCreateCategoryWithBudget as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const mutateAsync = jest.fn();

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <AddCategoryScreen />
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
  mutateAsync.mockResolvedValue(undefined);
  mockedUseCreateCategoryWithBudget.mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
  });
});

describe('AddCategoryScreen', () => {
  it('starts with the confirm key disabled until a name is entered', async () => {
    await renderScreen();

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Groceries');

    expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(false);
  });

  it('opens and closes the icon picker, updating the selected icon', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('icon-pill'));
    expect(screen.getByTestId('icon-option-heart')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('icon-option-heart'));
    expect(screen.queryByTestId('icon-option-heart')).toBeNull();
  });

  it('closes the icon picker when tapping outside it, without changing the icon', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('icon-pill'));
    expect(screen.getByTestId('icon-option-heart')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('icon-picker-backdrop'));

    expect(screen.queryByTestId('icon-option-heart')).toBeNull();
  });

  it('builds up the budget amount from keypad presses', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('keypad-digit-7'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-decimal-point'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));

    expect(screen.getByText('€70.5')).toBeTruthy();
  });

  it('submits the category, budget type, and amount, then navigates back on success', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Groceries');
    await fireEvent.press(screen.getByText('Savings'));
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-digit-0'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'Groceries',
      icon: 'cart',
      color: '#D2FFD8',
      budgetType: 'SAVINGS',
      month: '2026-09',
      monthlyBudgetCents: 5000,
    });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('shows an error message and does not navigate back when the mutation fails', async () => {
    mutateAsync.mockRejectedValue(new Error('network error'));
    mockedUseCreateCategoryWithBudget.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
    });
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Groceries');
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
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
    expect(screen.getByText('€0')).toBeTruthy(); // amount unchanged, no digit was registered

    await act(async () => {
      keyboardDidHide();
    });
    expect(screen.queryByTestId('keyboard-dismiss-overlay')).toBeNull();

    await fireEvent.press(screen.getByTestId('keypad-digit-7'));
    expect(screen.getByText('€7')).toBeTruthy();
  });
});
