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
import type { BudgetType, Category } from '../../src/api/types';
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
import { useTheme } from '../../src/theme/ThemeProvider';

// Need/Want only -- backend rejects 'savings' for a recurring expense (see docs/PLAN.md).
const BUDGET_TYPES: { key: Extract<BudgetType, 'NEED' | 'WANT'>; label: string }[] = [
  { key: 'NEED', label: 'Need' },
  { key: 'WANT', label: 'Want' },
];

const MAX_DUE_DAY = 31;
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
  const [dueDayText, setDueDayText] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('NEED');
  const [amountText, setAmountText] = useState('');
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

  const dueDay = dueDayText === '' ? null : Number(dueDayText);
  const isDueDayValid = dueDay !== null && dueDay >= 1 && dueDay <= MAX_DUE_DAY;

  const canSubmit =
    catalogReady &&
    !createRecurringExpense.isPending &&
    !!selectedCategory &&
    name.trim().length > 0 &&
    isDueDayValid &&
    amountTextToCents(amountText) > 0;

  function handleDueDayChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 2);
    if (digitsOnly !== '' && Number(digitsOnly) > MAX_DUE_DAY) return;
    setDueDayText(digitsOnly);
  }

  async function handleConfirm() {
    if (!canSubmit || !month || !selectedCategory || dueDay === null) return;

    try {
      await createRecurringExpense.mutateAsync({
        name: name.trim(),
        amountCents: amountTextToCents(amountText),
        categoryId: selectedCategory.id,
        budgetType,
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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
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
            placeholder="1-31"
            placeholderTextColor={colors.text.secondary}
            value={dueDayText}
            onChangeText={handleDueDayChange}
            maxLength={2}
          />
        </View>

        <Text
          style={[
            typography.scale.listSubtitle,
            styles.amountLabel,
            { color: colors.text.secondary },
          ]}
        >
          Amount
        </Text>
        <Text style={styles.amountRow}>
          <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          <Text style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}>
            {amountText || '0'}
          </Text>
        </Text>

        {createRecurringExpense.isError ? (
          <Text style={[styles.errorText, { color: colors.button.deleteBackground }]}>
            {GENERIC_ERROR_MESSAGE}
          </Text>
        ) : null}

        <View style={styles.keypadWrap}>
          <AmountKeypad
            onDigit={(digit) => setAmountText((text) => appendDigit(text, digit))}
            onDecimalPoint={() => setAmountText((text) => appendDecimalPoint(text))}
            onBackspace={() => setAmountText((text) => backspaceAmount(text))}
            onConfirm={handleConfirm}
            confirmDisabled={!canSubmit}
          />
        </View>
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
    flexGrow: 1,
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
  amountLabel: {
    textAlign: 'center',
    marginTop: 4,
  },
  amountRow: {
    textAlign: 'center',
    marginBottom: 8,
  },
  currencyPrefix: {
    fontSize: 26,
    fontFamily: 'Fredoka_400Regular',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 8,
  },
  keypadWrap: {
    minHeight: 260,
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
