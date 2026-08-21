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
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router, useLocalSearchParams } from 'expo-router';
import EditCategoryScreen from '../../../app/(app)/edit-category';

jest.mock('../../../src/api/categoryMutations');
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
const mockedRouterBack = router.back as jest.Mock;

const updateBudgetMutateAsync = jest.fn();
const updateCategoryMutateAsync = jest.fn();
const removeFromMonthMutateAsync = jest.fn();

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
      color: '#4C6EF5',
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

  it('shows a toast when the confirmed deletion fails (e.g. blocked by existing transactions)', async () => {
    removeFromMonthMutateAsync.mockRejectedValue(new Error('category_month_has_transactions'));
    mockedAlert.mockImplementation((_title, _message, buttons) => {
      const deleteButton = buttons?.find((button) => button.text === 'Delete');
      deleteButton?.onPress?.();
    });
    await renderScreen();

    await fireEvent.press(screen.getByTestId('delete-category-button'));

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
