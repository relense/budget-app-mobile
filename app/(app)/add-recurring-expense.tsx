import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentMonth } from '../../src/api/budgetHomeQueries';
import { useCategories } from '../../src/api/categoryQueries';
import { useCreateRecurringExpense } from '../../src/api/recurringExpenseMutations';
import type { Category } from '../../src/api/types';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ExistingCategoryPicker } from '../../src/components/ExistingCategoryPicker';
import { RetryableError } from '../../src/components/RetryableError';
import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
} from '../../src/lib/amountInput';
import {
  appendDayDigit,
  backspaceDay,
  formatMonthYearLabel,
  formatTypedDay,
  isCompleteDayDigits,
} from '../../src/lib/dateInput';
import { budgetTypeForCategory } from '../../src/lib/recurringBudgetType';
import { useTheme } from '../../src/theme/ThemeProvider';

const DUE_DAY_UNSET_PLACEHOLDER = '--';
const CATALOG_LOAD_ERROR = "Couldn't load your budget categories.";
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// A recurring expense always points at an existing EXPENSE category (never auto-created, see
// docs/PLAN.md's RecurringExpenseInput note) -- unlike Add Category, there's no "create a new
// category" option here, and the picker draws from the *full* catalog rather than only
// categories unused this month (a recurring expense can share a category that's already
// active, e.g. two bills both under "Housing").
export default function AddRecurringExpenseScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;
  const categoriesQuery = useCategories();
  const createRecurringExpense = useCreateRecurringExpense();

  const expenseCategories = (categoriesQuery.data ?? []).filter(
    (c) => c.direction === 'EXPENSE',
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [name, setName] = useState('');
  // dueDay has no natural pre-filled value on Add (unlike Edit), so a plain append-only buffer
  // is enough -- no "first touch replaces/clears" guard needed, the empty starting state
  // already behaves like a fresh field. Validated against the real day count of the current
  // budget month (appendDayDigit/daysInCurrentMonth, from dateInput.ts -- the same helpers
  // add-transaction.tsx uses for its date) even though RecurringExpenseInput.dueDay itself is
  // just a bare 1-31 Int with no stored month/year -- this is purely a display/typing
  // constraint tied to "the month this bill is being added in", not a schema change.
  const [dueDayDigits, setDueDayDigits] = useState('');
  const [amountText, setAmountText] = useState('');
  // Whether the shared keypad is in day-entry mode (its calendar-toggle key) instead of
  // amount-entry -- same mechanism add-transaction.tsx uses for its date, see AmountKeypad's
  // dateMode/onToggleDateMode props. Unlike add-transaction.tsx, the amount display never
  // hides/swaps for the due-date row -- both stay visible at all times, dateMode only decides
  // which one the keypad's digits/backspace currently affect.
  const [dateMode, setDateMode] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isCatalogLoading = currentMonthQuery.isLoading || categoriesQuery.isLoading;
  const isCatalogError = currentMonthQuery.isError || categoriesQuery.isError;
  const catalogReady = !isCatalogLoading && !isCatalogError && !!month;

  const selectedCategory: Category | null =
    expenseCategories.find((c) => c.id === selectedCategoryId) ?? expenseCategories[0] ?? null;

  const dueDay = isCompleteDayDigits(dueDayDigits) ? Number(dueDayDigits) : null;

  const canSubmit =
    catalogReady &&
    !createRecurringExpense.isPending &&
    !!selectedCategory &&
    name.trim().length > 0 &&
    dueDay !== null &&
    amountTextToCents(amountText) > 0;

  function handleDigit(digit: string) {
    if (dateMode) {
      if (month) setDueDayDigits((digits) => appendDayDigit(digits, digit, month));
    } else {
      setAmountText((text) => appendDigit(text, digit));
    }
  }

  function handleDecimalPoint() {
    if (dateMode) return; // a due day has no decimal segment
    setAmountText((text) => appendDecimalPoint(text));
  }

  function handleBackspace() {
    if (dateMode) {
      setDueDayDigits((digits) => backspaceDay(digits));
    } else {
      setAmountText((text) => backspaceAmount(text));
    }
  }

  async function handleConfirm() {
    if (!canSubmit || !month || !selectedCategory || dueDay === null) return;

    try {
      await createRecurringExpense.mutateAsync({
        name: name.trim(),
        amountCents: amountTextToCents(amountText),
        categoryId: selectedCategory.id,
        budgetType: budgetTypeForCategory(selectedCategory),
        dueDay,
        month,
      });
      router.back();
    } catch {
      // createRecurringExpense.isError drives the inline error message below.
    }
  }

  if (isCatalogError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
        </View>
        <View testID="add-recurring-expense-error" style={[styles.centered, { flex: 1 }]}>
          <RetryableError
            message={CATALOG_LOAD_ERROR}
            onRetry={() => {
              currentMonthQuery.refetch();
              categoriesQuery.refetch();
            }}
          />
        </View>
      </View>
    );
  }

  if (!catalogReady) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
        </View>
        <View testID="add-recurring-expense-loading" style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      </View>
    );
  }

  if (expenseCategories.length === 0 || !selectedCategory) {
    return (
      <View
        testID="add-recurring-expense-empty"
        style={[styles.container, styles.centered, { backgroundColor: colors.background.screen }]}
      >
        <Text style={[typography.scale.listSubtitle, { color: colors.text.secondary }]}>
          No budget categories yet.
        </Text>
        <Pressable style={styles.emptyBackButton} onPress={() => router.back()}>
          <Text style={[typography.scale.listSubtitle, { color: colors.text.primary }]}>
            Add one from the Available tab first
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <View style={styles.grabberRow}>
        <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.identityRow}>
          <Pressable
            testID="category-pill"
            style={[styles.categoryPill, { backgroundColor: selectedCategory.color }]}
            onPress={() => setOverlay((current) => !current)}
          >
            <CategoryIcon name={selectedCategory.icon} color={colors.text.primary} />
            <MaterialCommunityIcons
              name={overlay ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.text.primary}
            />
          </Pressable>
          <TextInput
            testID="recurring-name-input"
            style={[styles.nameInput, { backgroundColor: colors.pill.textInputBackground }]}
            placeholder="Bill name"
            placeholderTextColor={colors.text.secondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <Text style={styles.amountRow}>
          <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          <Text
            testID="calculator-value"
            style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}
          >
            {amountText || '0'}
          </Text>
        </Text>

        <Text style={styles.dueDateRow}>
          <Text testID="due-day-value" style={[styles.dueDateText, { color: colors.text.placeholder }]}>
            {dueDayDigits === '' ? DUE_DAY_UNSET_PLACEHOLDER : formatTypedDay(dueDayDigits)}
          </Text>
          <Text testID="due-month-year-value" style={[styles.dueDateText, { color: colors.text.primary }]}>
            {month ? ` ${formatMonthYearLabel(month)}` : ''}
          </Text>
        </Text>

        {createRecurringExpense.isError ? (
          <Text style={[styles.errorText, { color: colors.button.deleteBackground }]}>
            {GENERIC_ERROR_MESSAGE}
          </Text>
        ) : null}

        <View style={styles.keypadWrap}>
          <AmountKeypad
            onDigit={handleDigit}
            onDecimalPoint={handleDecimalPoint}
            onBackspace={handleBackspace}
            onConfirm={handleConfirm}
            confirmDisabled={!canSubmit}
            dateMode={dateMode}
            onToggleDateMode={() => setDateMode((current) => !current)}
          />
        </View>
      </View>

      {overlay ? (
        <>
          <Pressable
            testID="category-picker-backdrop"
            style={[StyleSheet.absoluteFill, styles.overlayBackdrop]}
            onPress={() => setOverlay(false)}
          />
          <View
            style={[
              styles.overlayCard,
              { backgroundColor: colors.background.screen, borderColor: colors.segment.track },
            ]}
          >
            <ScrollView style={styles.categoryListScroll}>
              <ExistingCategoryPicker
                categories={expenseCategories}
                onSelectExisting={(category) => {
                  setSelectedCategoryId(category.id);
                  setOverlay(false);
                }}
              />
            </ScrollView>
          </View>
        </>
      ) : null}

      {keyboardVisible ? (
        <Pressable
          testID="keyboard-dismiss-overlay"
          style={[StyleSheet.absoluteFill, styles.keyboardDismissOverlay]}
          onPress={() => Keyboard.dismiss()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyBackButton: {
    paddingVertical: 8,
  },
  grabberRow: {
    alignItems: 'center',
    paddingTop: 10,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 20,
    fontSize: 16,
  },
  amountRow: {
    textAlign: 'center',
    marginTop: 4,
  },
  currencyPrefix: {
    fontSize: 26,
    fontFamily: 'Fredoka_400Regular',
  },
  dueDateRow: {
    textAlign: 'center',
    marginBottom: 8,
  },
  dueDateText: {
    fontSize: 16,
    fontFamily: 'Fredoka_400Regular',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 8,
  },
  keypadWrap: {
    flex: 1,
  },
  overlayBackdrop: {
    zIndex: 9,
  },
  overlayCard: {
    position: 'absolute',
    top: 74,
    left: 24,
    right: 24,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    zIndex: 10,
    elevation: 4,
  },
  categoryListScroll: {
    maxHeight: 260,
  },
  keyboardDismissOverlay: {
    zIndex: 20,
  },
});
