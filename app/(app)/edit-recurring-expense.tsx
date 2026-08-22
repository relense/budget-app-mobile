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

import { useCategories } from '../../src/api/categoryQueries';
import {
  useMarkRecurringPaid,
  useRemoveRecurringExpenseFromMonth,
  useUpdateRecurringExpense,
} from '../../src/api/recurringExpenseMutations';
import { useDeleteTransaction } from '../../src/api/transactionMutations';
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
import { todayIsoDate } from '../../src/lib/today';
import { useTheme } from '../../src/theme/ThemeProvider';

const BUDGET_TYPES: { key: Extract<BudgetType, 'NEED' | 'WANT'>; label: string }[] = [
  { key: 'NEED', label: 'Need' },
  { key: 'WANT', label: 'Want' },
];

const MAX_DUE_DAY = 31;
const TOAST_DURATION_MS = 2500;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Reached only by swiping a Recurrent row (same SwipeableRow pattern as Available/Expenses,
// tapping the row itself does nothing) -- combines everything the mockup's keypad screen shows
// (Paid/Unpaid pill, amount, Delete) with full editing of name/category/Need-Want/due-day,
// which the mockup doesn't show fields for but the user asked to be able to change without
// deleting and re-adding the bill.
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

  const categoriesQuery = useCategories();
  const updateRecurringExpense = useUpdateRecurringExpense();
  const markRecurringPaid = useMarkRecurringPaid();
  const removeFromMonth = useRemoveRecurringExpenseFromMonth();
  const deleteTransaction = useDeleteTransaction();

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
  const [budgetType, setBudgetType] = useState<Extract<BudgetType, 'NEED' | 'WANT'>>(
    params.budgetType === 'WANT' ? 'WANT' : 'NEED',
  );
  const [dueDayText, setDueDayText] = useState(params.dueDay);
  const [amountText, setAmountText] = useState(() => centsToAmountText(Number(params.amountCents)));
  // Same "first key clears the pre-filled value" guard as edit-category.tsx -- the pre-filled
  // amount always has 2 decimal digits already, which appendDigit/appendDecimalPoint treat as
  // "already complete" and refuse to extend.
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [paid, setPaid] = useState(params.paidThisMonth === 'true');
  const [overlay, setOverlay] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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

  const dueDay = dueDayText === '' ? null : Number(dueDayText);
  const isDueDayValid = dueDay !== null && dueDay >= 1 && dueDay <= MAX_DUE_DAY;
  const isMutating =
    updateRecurringExpense.isPending || markRecurringPaid.isPending || removeFromMonth.isPending ||
    deleteTransaction.isPending;

  const canSubmit =
    !isMutating && name.trim().length > 0 && isDueDayValid && amountTextToCents(amountText) > 0;

  function handleDigit(digit: string) {
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText(digit === '0' ? '0' : digit);
      return;
    }
    setAmountText((text) => appendDigit(text, digit));
  }

  function handleDecimalPoint() {
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText('0.');
      return;
    }
    setAmountText((text) => appendDecimalPoint(text));
  }

  function handleBackspace() {
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText('');
      return;
    }
    setAmountText((text) => backspaceAmount(text));
  }

  function handleDueDayChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 2);
    if (digitsOnly !== '' && Number(digitsOnly) > MAX_DUE_DAY) return;
    setDueDayText(digitsOnly);
  }

  async function handleTogglePaid() {
    if (isMutating) return;
    try {
      if (paid) {
        await Promise.all(
          transactionIds.map((transactionId) => deleteTransaction.mutateAsync({ transactionId })),
        );
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
    if (!canSubmit || dueDay === null) return;
    try {
      await updateRecurringExpense.mutateAsync({
        recurringExpenseId: params.recurringExpenseId,
        name: name.trim(),
        amountCents: amountTextToCents(amountText),
        categoryId: selectedCategory.id,
        budgetType,
        dueDay,
      });
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  function handleDeletePress() {
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
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  if (categoriesQuery.isLoading) {
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

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
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
          />
        </View>

        <View style={[styles.budgetTypeRow, { backgroundColor: colors.segment.track }]}>
          {BUDGET_TYPES.map(({ key, label }) => (
            <Pressable
              key={key}
              testID={`budget-type-${key}`}
              style={[
                styles.budgetTypeButton,
                budgetType === key && { backgroundColor: colors.segment.active },
              ]}
              onPress={() => setBudgetType(key)}
            >
              <Text
                style={[
                  typography.scale.segmentLabel,
                  {
                    color:
                      budgetType === key ? colors.segment.activeText : colors.segment.inactiveText,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.dueDayRow}>
          <Text style={[typography.scale.listSubtitle, { color: colors.text.secondary }]}>
            Due day
          </Text>
          <TextInput
            testID="due-day-input"
            style={[
              styles.dueDayInput,
              { backgroundColor: colors.pill.textInputBackground, color: colors.text.primary },
            ]}
            keyboardType="number-pad"
            value={dueDayText}
            onChangeText={handleDueDayChange}
            maxLength={2}
          />
        </View>

        <Text style={styles.amountRow}>
          <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          <Text style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}>
            {amountText || '0'}
          </Text>
        </Text>

        <View style={styles.keypadWrap}>
          <AmountKeypad
            onDigit={handleDigit}
            onDecimalPoint={handleDecimalPoint}
            onBackspace={handleBackspace}
            onConfirm={handleConfirm}
            confirmDisabled={!canSubmit}
          />
        </View>

        <Pressable
          testID="delete-recurring-expense-button"
          style={[styles.deleteButton, { backgroundColor: colors.button.deleteBackground }]}
          onPress={handleDeletePress}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text.onDark} />
          <Text style={[styles.deleteLabel, { color: colors.text.onDark }]}>Delete</Text>
        </Pressable>
      </ScrollView>

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

      {keyboardVisible ? (
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  paidPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
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
  budgetTypeRow: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
  },
  budgetTypeButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  dueDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDayInput: {
    width: 72,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
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
    minHeight: 260,
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
