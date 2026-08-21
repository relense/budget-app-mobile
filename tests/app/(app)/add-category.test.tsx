import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCategoryMonths, useCurrentMonth } from '../../../src/api/budgetHomeQueries';
import {
  useAddCategoryToMonth,
  useCreateCategoryWithBudget,
} from '../../../src/api/categoryMutations';
import { useCategories } from '../../../src/api/categoryQueries';
import { colorForIcon } from '../../../src/lib/categoryIconPalette';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import AddCategoryScreen from '../../../app/(app)/add-category';

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/api/categoryMutations');
jest.mock('../../../src/api/categoryQueries');
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
const mockedUseCategoryMonths = useCategoryMonths as jest.Mock;
const mockedUseCategories = useCategories as jest.Mock;
const mockedUseCreateCategoryWithBudget = useCreateCategoryWithBudget as jest.Mock;
const mockedUseAddCategoryToMonth = useAddCategoryToMonth as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const createMutateAsync = jest.fn();
const addExistingMutateAsync = jest.fn();

// Deliberately not colorForIcon('fuel') -- stands in for a category whose stored color has
// drifted from the palette (e.g. a legacy value), so tests can assert the pill ignores it.
const GAS_STUB_COLOR = colorForIcon('utensils');

const gasCategory = {
  id: 'cat-gas',
  name: 'Gas',
  icon: 'fuel',
  color: GAS_STUB_COLOR,
  budgetType: 'NEED' as const,
  direction: 'EXPENSE' as const,
};

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
  mockedUseCategoryMonths.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockedUseCategories.mockReturnValue({ data: [], isLoading: false, isError: false });
  createMutateAsync.mockResolvedValue(undefined);
  addExistingMutateAsync.mockResolvedValue(undefined);
  mockedUseCreateCategoryWithBudget.mockReturnValue({
    mutateAsync: createMutateAsync,
    isPending: false,
    isError: false,
  });
  mockedUseAddCategoryToMonth.mockReturnValue({
    mutateAsync: addExistingMutateAsync,
    isPending: false,
    isError: false,
  });
});

describe('AddCategoryScreen', () => {
  it('shows a loading state instead of the create-new form while the catalog is still loading', async () => {
    mockedUseCategories.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await renderScreen();

    expect(screen.getByTestId('add-category-loading')).toBeTruthy();
    expect(screen.queryByTestId('category-name-input')).toBeNull();
    expect(screen.queryByTestId('choose-existing-button')).toBeNull();
  });

  it('shows the choice screen (not a premature create-new form) once a slow catalog fetch resolves with unused categories', async () => {
    // Regression test: useCategories is only ever called from this screen (unlike
    // useCategoryMonths, which Home already warms), so its first render is `isLoading: true`.
    // Before the catalogReady gate, that briefly resolved unusedCategories as empty and showed
    // the create-new form, which then flipped to the choice screen once data landed.
    mockedUseCategories.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { rerender } = await renderScreen();

    expect(screen.getByTestId('add-category-loading')).toBeTruthy();

    mockedUseCategories.mockReturnValue({
      data: [gasCategory],
      isLoading: false,
      isError: false,
    });
    await rerender(
      <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
        <ThemeProvider>
          <AddCategoryScreen />
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    expect(screen.queryByTestId('add-category-loading')).toBeNull();
    expect(screen.getByTestId('choose-existing-button')).toBeTruthy();
    expect(screen.queryByTestId('category-name-input')).toBeNull();
  });

  it('goes straight to the create-new form when no unused categories exist', async () => {
    await renderScreen();

    expect(screen.getByTestId('category-name-input')).toBeTruthy();
    expect(screen.queryByTestId('choose-existing-button')).toBeNull();
  });

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

    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'Groceries',
      icon: 'cart',
      color: colorForIcon('cart'),
      budgetType: 'SAVINGS',
      month: '2026-09',
      monthlyBudgetCents: 5000,
    });
    expect(mockedRouterBack).toHaveBeenCalled();
  });

  it('shows an error message and does not navigate back when the mutation fails', async () => {
    createMutateAsync.mockRejectedValue(new Error('network error'));
    mockedUseCreateCategoryWithBudget.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
      isError: true,
    });
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Groceries');
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(mockedRouterBack).not.toHaveBeenCalled();
  });

  it('blocks creating a duplicate-named category and shows a toast instead', async () => {
    mockedUseCategories.mockReturnValue({
      data: [gasCategory],
      isLoading: false,
      isError: false,
    });
    // "Gas" is already active this month too, so no choice screen appears (nothing unused to
    // offer) -- but the create-new form must still reject a duplicate name.
    mockedUseCategoryMonths.mockReturnValue({
      data: [
        {
          id: 'cm-gas',
          month: '2026-09',
          monthlyBudgetCents: 0,
          actualAmountCents: 0,
          recurringCommittedCents: 0,
          category: gasCategory,
          transactions: [],
        },
      ],
      isLoading: false,
      isError: false,
    });
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('category-name-input'), '  gas  ');
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Category already exists')).toBeTruthy();
    expect(createMutateAsync).not.toHaveBeenCalled();
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

  describe('with an unused existing category', () => {
    beforeEach(() => {
      mockedUseCategories.mockReturnValue({
        data: [gasCategory],
        isLoading: false,
        isError: false,
      });
      // Gas is in the catalog but not active this month -- categoryMonths stays empty.
    });

    it('shows the "select existing vs. create new" choice first, not the form', async () => {
      await renderScreen();

      expect(screen.getByTestId('choose-existing-button')).toBeTruthy();
      expect(screen.getByTestId('choose-new-button')).toBeTruthy();
      expect(screen.queryByTestId('category-name-input')).toBeNull();
    });

    it('"Select Existing" opens the category list as an overlay, dismissible by tapping outside', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-existing-button'));
      expect(screen.getByText('Gas')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('icon-picker-backdrop'));
      expect(screen.queryByText('Gas')).toBeNull();
      expect(screen.getByTestId('choose-existing-button')).toBeTruthy();
    });

    it('can enter the budget amount before choosing a category, but confirm stays disabled', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      expect(screen.getByText('€5')).toBeTruthy();
      expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(true);
    });

    it('selecting an existing category locks name/budget-type and submits via addCategoryToMonth only', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-existing-button'));
      await fireEvent.press(screen.getByTestId('existing-category-cat-gas'));

      expect(screen.getByDisplayValue('Gas').props.editable).toBe(false);
      expect(screen.getByTestId('keypad-confirm').props.accessibilityState.disabled).toBe(false);
      // gasCategory.color (GAS_STUB_COLOR) is a deliberately mismatched stub -- the pill must
      // use colorForIcon('fuel') instead of that raw stored value, matching the
      // existing-category list it was just picked from.
      expect(GAS_STUB_COLOR).not.toBe(colorForIcon('fuel'));
      const pillStyle = ([] as unknown[])
        .concat(screen.getByTestId('icon-pill').props.style)
        .filter(Boolean) as Record<string, unknown>[];
      expect(pillStyle.some((s) => s.backgroundColor === colorForIcon('fuel'))).toBe(true);

      await fireEvent.press(screen.getByTestId('keypad-digit-5'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(addExistingMutateAsync).toHaveBeenCalledWith({
        categoryId: 'cat-gas',
        month: '2026-09',
        monthlyBudgetCents: 500,
      });
      expect(createMutateAsync).not.toHaveBeenCalled();
      expect(mockedRouterBack).toHaveBeenCalled();
    });

    it('shows an error message and does not navigate back when adding an existing category fails', async () => {
      addExistingMutateAsync.mockRejectedValue(new Error('network error'));
      mockedUseAddCategoryToMonth.mockReturnValue({
        mutateAsync: addExistingMutateAsync,
        isPending: false,
        isError: true,
      });
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-existing-button'));
      await fireEvent.press(screen.getByTestId('existing-category-cat-gas'));
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
      expect(mockedRouterBack).not.toHaveBeenCalled();
    });

    it('going back from "Create New" and choosing it again starts with a genuinely blank form', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-new-button'));
      await fireEvent.press(screen.getByTestId('icon-pill'));
      await fireEvent.press(screen.getByTestId('icon-option-heart'));
      await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Health');

      await fireEvent.press(screen.getByTestId('back-to-choice'));
      await fireEvent.press(screen.getByTestId('choose-new-button'));

      expect(screen.getByDisplayValue('')).toBeTruthy();
      expect(screen.queryByDisplayValue('Health')).toBeNull();
    });

    it('selecting an existing category also shows a back button, letting the user reconsider', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-existing-button'));
      await fireEvent.press(screen.getByTestId('existing-category-cat-gas'));

      await fireEvent.press(screen.getByTestId('back-to-choice'));

      expect(screen.getByTestId('choose-existing-button')).toBeTruthy();
      expect(screen.getByTestId('choose-new-button')).toBeTruthy();
      // Going back and choosing "Create New" should start a genuinely fresh form, not carry
      // over the category they'd picked before changing their mind.
      await fireEvent.press(screen.getByTestId('choose-new-button'));
      expect(screen.getByTestId('category-name-input').props.editable).toBe(true);
    });

    it('"Create New" swaps in today\'s full form to create a brand new category', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-new-button'));
      expect(screen.queryByTestId('choose-existing-button')).toBeNull();

      await fireEvent.press(screen.getByTestId('icon-pill'));
      await fireEvent.press(screen.getByTestId('icon-option-heart'));
      await fireEvent.changeText(screen.getByTestId('category-name-input'), 'Health');
      await fireEvent.press(screen.getByTestId('keypad-confirm'));

      expect(createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Health', icon: 'heart' }),
      );
    });

    it('"Create New" shows a back button that returns to the choice screen', async () => {
      await renderScreen();

      await fireEvent.press(screen.getByTestId('choose-new-button'));
      expect(screen.getByTestId('back-to-choice')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('back-to-choice'));

      expect(screen.getByTestId('choose-existing-button')).toBeTruthy();
      expect(screen.getByTestId('choose-new-button')).toBeTruthy();
    });
  });

  it('does not show a back button when there was never a choice to make', async () => {
    await renderScreen();

    expect(screen.queryByTestId('back-to-choice')).toBeNull();
  });
});
