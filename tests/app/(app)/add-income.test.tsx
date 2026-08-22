import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const testSafeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

import { useCategoryMonths, useCurrentMonth } from '../../../src/api/budgetHomeQueries';
import {
  useAddCategoryToMonth,
  useCreateIncomeCategoryWithBudget,
} from '../../../src/api/categoryMutations';
import { useCategories } from '../../../src/api/categoryQueries';
import { INCOME_ICON_PALETTE } from '../../../src/lib/categoryIconPalette';
import { ThemeProvider } from '../../../src/theme/ThemeProvider';
import { router } from 'expo-router';
import AddIncomeScreen from '../../../app/(app)/add-income';

jest.mock('../../../src/api/budgetHomeQueries');
jest.mock('../../../src/api/categoryMutations');
jest.mock('../../../src/api/categoryQueries');
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

const mockedUseCurrentMonth = useCurrentMonth as jest.Mock;
const mockedUseCategoryMonths = useCategoryMonths as jest.Mock;
const mockedUseCategories = useCategories as jest.Mock;
const mockedUseCreateIncomeCategoryWithBudget = useCreateIncomeCategoryWithBudget as jest.Mock;
const mockedUseAddCategoryToMonth = useAddCategoryToMonth as jest.Mock;
const mockedRouterBack = router.back as jest.Mock;

const createMutateAsync = jest.fn();
const addExistingMutateAsync = jest.fn();

const obconnectCategory = {
  id: 'cat-obconnect',
  name: 'Obconnect',
  icon: 'briefcase',
  color: '#B8D8F0',
  budgetType: null,
  direction: 'INCOME' as const,
};

const shoppingCategory = {
  id: 'cat-shopping',
  name: 'Shopping',
  icon: 'cart',
  color: '#CEF3C8',
  budgetType: 'NEED' as const,
  direction: 'EXPENSE' as const,
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
      <ThemeProvider>
        <AddIncomeScreen />
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
    data: [],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockedUseCategories.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
  createMutateAsync.mockResolvedValue(undefined);
  addExistingMutateAsync.mockResolvedValue(undefined);
  mockedUseCreateIncomeCategoryWithBudget.mockReturnValue({
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

describe('AddIncomeScreen', () => {
  it('shows a loading state while the catalog is loading', async () => {
    mockedUseCategories.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await renderScreen();

    expect(screen.getByTestId('add-income-loading')).toBeTruthy();
  });

  it('shows a retryable error when the catalog fails to load', async () => {
    mockedUseCategories.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByTestId('add-income-error')).toBeTruthy();
  });

  it('skips the choice screen and goes straight to the create form when there is no unused income category', async () => {
    mockedUseCategories.mockReturnValue({
      data: [shoppingCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.queryByTestId('choose-existing-button')).toBeNull();
    expect(screen.getByTestId('income-name-input')).toBeTruthy();
  });

  it('shows the existing-vs-create choice when an unused income category exists', async () => {
    mockedUseCategories.mockReturnValue({
      data: [obconnectCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();

    expect(screen.getByTestId('choose-existing-button')).toBeTruthy();
    expect(screen.getByTestId('choose-new-button')).toBeTruthy();
  });

  it('the existing-category picker only offers income-direction categories', async () => {
    mockedUseCategories.mockReturnValue({
      data: [obconnectCategory, shoppingCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('choose-existing-button'));

    expect(screen.getByTestId('existing-category-cat-obconnect')).toBeTruthy();
    expect(screen.queryByTestId('existing-category-cat-shopping')).toBeNull();
  });

  it('selecting an existing income category locks the name and submits via addCategoryToMonth only', async () => {
    mockedUseCategories.mockReturnValue({
      data: [obconnectCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('choose-existing-button'));
    await fireEvent.press(screen.getByTestId('existing-category-cat-obconnect'));

    expect(screen.getByTestId('income-name-input').props.value).toBe('Obconnect');
    expect(screen.getByTestId('income-name-input').props.editable).toBe(false);

    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(addExistingMutateAsync).toHaveBeenCalledWith({
      categoryId: 'cat-obconnect',
      month: '2026-09',
      monthlyBudgetCents: 500,
    });
    expect(createMutateAsync).not.toHaveBeenCalled();
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('the icon picker only offers the income icon palette (briefcase/shield)', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('icon-pill'));

    for (const { icon } of INCOME_ICON_PALETTE) {
      expect(screen.getByTestId(`icon-option-${icon}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('icon-option-cart')).toBeNull();
  });

  it('creates a new INCOME category via createIncomeCategoryWithBudget and navigates back', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('income-name-input'), 'Randstad');
    await fireEvent.press(screen.getByTestId('keypad-digit-9'));

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      name: 'Randstad',
      icon: INCOME_ICON_PALETTE[0].icon,
      color: INCOME_ICON_PALETTE[0].color,
      month: '2026-09',
      monthlyBudgetCents: 900,
    });
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('allows creating a new income category with the amount left at €0 -- a placeholder budget to fill in later is a deliberate, allowed state, same as add-category.tsx', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('income-name-input'), 'Randstad');
    // Amount field is never touched -- confirm is enabled purely on the name being set.
    expect(screen.getByTestId('keypad-confirm').props.accessibilityState?.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Randstad', monthlyBudgetCents: 0 }),
    );
    expect(mockedRouterBack).toHaveBeenCalledTimes(1);
  });

  it('blocks creating a duplicate-named income category and shows a toast instead', async () => {
    mockedUseCategories.mockReturnValue({
      data: [obconnectCategory, shoppingCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('choose-new-button'));
    await fireEvent.changeText(screen.getByTestId('income-name-input'), 'Obconnect');
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(screen.getByText('Income category already exists')).toBeTruthy();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('does not block a name that only collides with an EXPENSE category of the same name', async () => {
    mockedUseCategories.mockReturnValue({
      data: [shoppingCategory],
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('income-name-input'), 'Shopping');
    await fireEvent.press(screen.getByTestId('keypad-digit-5'));
    await fireEvent.press(screen.getByTestId('keypad-confirm'));

    expect(createMutateAsync).toHaveBeenCalled();
  });
});
