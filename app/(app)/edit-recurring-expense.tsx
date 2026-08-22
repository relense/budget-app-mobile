import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCategoryMonths, useCurrentMonth } from '../../src/api/budgetHomeQueries';
import { useUpdateCategoryMonthBudget } from '../../src/api/categoryMutations';
import { useCategories } from '../../src/api/categoryQueries';
import {
  useMarkRecurringPaid,
  useRemoveRecurringExpenseFromMonth,
  useUnmarkRecurringPaid,
  useUpdateRecurringExpense,
} from '../../src/api/recurringExpenseMutations';
import type { BudgetType, Category } from '../../src/api/types';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ExistingCategoryPicker } from '../../src/components/ExistingCategoryPicker';
import { Toast } from '../../src/components/Toast';
import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
  centsToAmountText,
} from '../../src/lib/amountInput';
import {
  appendDayDigit,
  backspaceDay,
  formatMonthYearLabel,
  formatTypedDay,
  isCompleteDayDigits,
} from '../../src/lib/dateInput';
import { budgetTypeForCategory } from '../../src/lib/recurringBudgetType';
import { syncCategoryMonthBudget } from '../../src/lib/syncCategoryMonthBudget';
import { todayIsoDate } from '../../src/lib/today';
import { useTheme } from '../../src/theme/ThemeProvider';

const DUE_DAY_UNSET_PLACEHOLDER = '--';
const TOAST_DURATION_MS = 2500;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Reached only by swiping a Recurrent row (same SwipeableRow pattern as Available/Expenses --
// tapping a row's icon toggles paid state directly from Home, see index.tsx, and tapping the
// rest of the row does nothing). Combines the mockup's keypad screen (Paid/Unpaid pill, amount,
// Delete) with editing name/category/due-day -- the mockup doesn't show fields for those, but
// the user asked to be able to change them without deleting and re-adding the bill.
// Need/Want is deliberately not editable here (or on Add): it's derived from the chosen
// category via budgetTypeForCategory, not asked for separately.
export default function EditRecurringExpenseScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    recurringExpenseId: string;
    name: string;
    amountCents: string;
    categoryId: string;
    categoryIcon: string;
    categoryColor: string;
    budgetType: string;
    dueDay: string;
    paidThisMonth: string;
    transactionIds: string;
  }>();

  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;
  const categoriesQuery = useCategories();
  const categoryMonthsQuery = useCategoryMonths(month, 'EXPENSE');
  const updateRecurringExpense = useUpdateRecurringExpense();
  const updateCategoryMonthBudget = useUpdateCategoryMonthBudget();
  const markRecurringPaid = useMarkRecurringPaid();
  const unmarkRecurringPaid = useUnmarkRecurringPaid();
  const removeFromMonth = useRemoveRecurringExpenseFromMonth();

  const expenseCategories = (categoriesQuery.data ?? []).filter(
    (c) => c.direction === 'EXPENSE',
  );
  const transactionIds: string[] = params.transactionIds ? JSON.parse(params.transactionIds) : [];

  const [name, setName] = useState(params.name);
  const [selectedCategory, setSelectedCategory] = useState<Category>({
    id: params.categoryId,
    name: params.name,
    icon: params.categoryIcon,
    color: params.categoryColor,
    budgetType: (params.budgetType as BudgetType) ?? null,
    direction: 'EXPENSE',
  });
  // Same "first touch replaces/clears the pre-filled value outright" pattern as the amount
  // field below (hasEditedAmount) -- dueDayDigits starts pre-filled from params, and the first
  // digit or backspace press in day-entry mode either replaces it wholesale or clears it to
  // blank; after that, digits/backspace behave normally on the live value (validated against
  // the real day count of the current budget month via appendDayDigit, from dateInput.ts -- the
  // same helpers add-transaction.tsx uses for its date). This is also why a save with the field
  // left blank has to fall back to the original due day rather than being blocked -- see
  // handleConfirm.
  const [dueDayDigits, setDueDayDigits] = useState(params.dueDay);
  const [hasEditedDueDay, setHasEditedDueDay] = useState(false);
  const [amountText, setAmountText] = useState(() => centsToAmountText(Number(params.amountCents)));
  // Same "first key clears the pre-filled value" guard as edit-category.tsx -- the pre-filled
  // amount always has 2 decimal digits already, which appendDigit/appendDecimalPoint treat as
  // "already complete" and refuse to extend.
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [paid, setPaid] = useState(params.paidThisMonth === 'true');
  // Whether the shared keypad is in day-entry mode (its calendar-toggle key) instead of
  // amount-entry -- same mechanism/swap behavior as add-transaction.tsx's date: pressing the
  // toggle key replaces the single calculator display with the due-day value instead of
  // showing both at once.
  const [dateMode, setDateMode] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // The keyboard-dismiss-overlay below exists to eat a stray tap meant to dismiss the keyboard
  // from landing on a keypad button underneath -- it was never meant to cover the name field
  // itself. Rendering it the instant the keyboard appears (which happens the moment this field
  // is tapped) sat it directly on top of the just-focused native TextInput, which was
  // interfering with normal typing/selection. Gated on this so it never covers the field you're
  // actually typing into.
  const [nameFocused, setNameFocused] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const dueDay = isCompleteDayDigits(dueDayDigits) ? Number(dueDayDigits) : null;
  const isMutating =
    updateRecurringExpense.isPending ||
    updateCategoryMonthBudget.isPending ||
    markRecurringPaid.isPending ||
    unmarkRecurringPaid.isPending ||
    removeFromMonth.isPending;

  // Due day is deliberately not required here (unlike Add) -- leaving it blank and saving
  // falls back to the original value instead of blocking the save, see handleConfirm.
  const canSubmit = !isMutating && name.trim().length > 0 && amountTextToCents(amountText) > 0;

  function handleDigit(digit: string) {
    if (dateMode) {
      if (!hasEditedDueDay) {
        setHasEditedDueDay(true);
        setDueDayDigits(digit);
        return;
      }
      if (month) setDueDayDigits((digits) => appendDayDigit(digits, digit, month));
      return;
    }
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText(digit === '0' ? '0' : digit);
      return;
    }
    setAmountText((text) => appendDigit(text, digit));
  }

  function handleDecimalPoint() {
    if (dateMode) return; // a due day has no decimal segment
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText('0.');
      return;
    }
    setAmountText((text) => appendDecimalPoint(text));
  }

  function handleBackspace() {
    if (dateMode) {
      if (!hasEditedDueDay) {
        setHasEditedDueDay(true);
        setDueDayDigits('');
        return;
      }
      setDueDayDigits((digits) => backspaceDay(digits));
      return;
    }
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText('');
      return;
    }
    setAmountText((text) => backspaceAmount(text));
  }

  async function handleTogglePaid() {
    if (isMutating) return;
    try {
      if (paid) {
        await unmarkRecurringPaid.mutateAsync(transactionIds);
      } else {
        await markRecurringPaid.mutateAsync({
          recurringExpenseId: params.recurringExpenseId,
          amountCents: amountTextToCents(amountText),
          date: todayIsoDate(),
        });
      }
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  async function handleConfirm() {
    if (!canSubmit) return;
    // Left blank (cleared and never re-typed) -- fall back to the value this row already had
    // rather than blocking the save or sending an invalid one (RecurringExpenseInput.dueDay is
    // required, there's no "leave it unchanged" option server-side).
    const finalDueDay = dueDay ?? Number(params.dueDay);
    const newAmountCents = amountTextToCents(amountText);
    const oldAmountCents = Number(params.amountCents);
    const categoryChanged = selectedCategory.id !== params.categoryId;
    try {
      await updateRecurringExpense.mutateAsync({
        recurringExpenseId: params.recurringExpenseId,
        name: name.trim(),
        amountCents: newAmountCents,
        categoryId: selectedCategory.id,
        budgetType: budgetTypeForCategory(selectedCategory),
        dueDay: finalDueDay,
      });
      // Keep each affected category's own monthlyBudgetCents in sync with this bill's amount --
      // see syncCategoryMonthBudget's own comment for the exact semantics/edge cases. If the
      // category changed, this bill's old amount comes out of the old category and the new
      // amount goes into the new one, rather than a single delta on one category.
      const updateBudget = (input: Parameters<typeof updateCategoryMonthBudget.mutateAsync>[0]) =>
        updateCategoryMonthBudget.mutateAsync(input);
      if (categoryChanged) {
        await syncCategoryMonthBudget(
          categoryMonthsQuery.data,
          params.categoryId,
          -oldAmountCents,
          updateBudget,
        );
        await syncCategoryMonthBudget(
          categoryMonthsQuery.data,
          selectedCategory.id,
          newAmountCents,
          updateBudget,
        );
      } else {
        await syncCategoryMonthBudget(
          categoryMonthsQuery.data,
          selectedCategory.id,
          newAmountCents - oldAmountCents,
          updateBudget,
        );
      }
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  function handleDeletePress() {
    // The backend blocks removeRecurringExpenseFromMonth while any Transaction references it
    // (see docs/SERVICES.md) -- true for any bill currently marked Paid. Caught here with a
    // clear message instead of letting it fail server-side into the generic error toast.
    if (paid) {
      setToastMessage('Mark as unpaid before deleting.');
      return;
    }
    Alert.alert(
      'Delete recurring expense',
      `Delete "${name}"? This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteConfirmed },
      ],
    );
  }

  async function handleDeleteConfirmed() {
    try {
      await removeFromMonth.mutateAsync({ recurringExpenseId: params.recurringExpenseId });
      // This bill no longer commits anything -- take its amount back out of the category's own
      // monthlyBudgetCents (see syncCategoryMonthBudget's own comment for the exact semantics).
      await syncCategoryMonthBudget(
        categoryMonthsQuery.data,
        params.categoryId,
        -Number(params.amountCents),
        (input) => updateCategoryMonthBudget.mutateAsync(input),
      );
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  if (categoriesQuery.isLoading || currentMonthQuery.isLoading || categoryMonthsQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
        </View>
        <View testID="edit-recurring-expense-loading" style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <View style={styles.grabberRow}>
        <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          testID="paid-pill"
          style={[
            styles.paidPill,
            { backgroundColor: paid ? colors.status.paid.background : colors.status.unpaid.background },
          ]}
          disabled={isMutating}
          onPress={handleTogglePaid}
        >
          <Text
            style={[
              typography.scale.segmentLabel,
              { color: paid ? colors.status.paid.text : colors.status.unpaid.text },
            ]}
          >
            {paid ? 'Paid' : 'Unpaid'}
          </Text>
          {paid ? (
            <MaterialCommunityIcons name="check" size={18} color={colors.status.paid.text} />
          ) : null}
        </Pressable>

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
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>

        <Text style={styles.amountRow}>
          {dateMode ? (
            <>
              <Text
                testID="due-day-value"
                style={[
                  typography.scale.calculatorAmount,
                  {
                    color:
                      dueDayDigits === '' ? colors.text.placeholder : colors.text.primary,
                  },
                ]}
              >
                {dueDayDigits === '' ? DUE_DAY_UNSET_PLACEHOLDER : formatTypedDay(dueDayDigits)}
              </Text>
              <Text
                testID="due-month-year-value"
                style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}
              >
                {month ? ` ${formatMonthYearLabel(month)}` : ''}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
              <Text
                testID="calculator-value"
                style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}
              >
                {amountText || '0'}
              </Text>
            </>
          )}
        </Text>

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

        <Pressable
          testID="delete-recurring-expense-button"
          style={[
            styles.deleteButton,
            { backgroundColor: colors.button.deleteBackground, opacity: paid ? 0.4 : 1 },
          ]}
          onPress={handleDeletePress}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text.onDark} />
          <Text style={[styles.deleteLabel, { color: colors.text.onDark }]}>Delete</Text>
        </Pressable>
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
                  setSelectedCategory(category);
                  setOverlay(false);
                }}
              />
            </ScrollView>
          </View>
        </>
      ) : null}

      {keyboardVisible && !nameFocused ? (
        <Pressable
          testID="keyboard-dismiss-overlay"
          style={[StyleSheet.absoluteFill, styles.keyboardDismissOverlay]}
          onPress={() => Keyboard.dismiss()}
        />
      ) : null}

      <Toast message={toastMessage} />
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
  // Full-width banner (not a small round pill) -- label on the left, checkmark (when Paid) at
  // the far right edge, matching the mockup's actual layout.
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
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
    marginBottom: 8,
  },
  currencyPrefix: {
    fontSize: 26,
    fontFamily: 'Fredoka_400Regular',
  },
  keypadWrap: {
    flex: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
  },
  deleteLabel: {
    fontSize: 15,
    fontWeight: '600',
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
