import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useRemoveCategoryFromMonth,
  useUpdateCategory,
  useUpdateCategoryMonthBudget,
} from '../../src/api/categoryMutations';
import { hasGraphqlErrorCode } from '../../src/api/graphqlClient';
import type { BudgetType, Direction } from '../../src/api/types';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { IconPicker } from '../../src/components/IconPicker';
import { Toast } from '../../src/components/Toast';
import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
  centsToAmountText,
} from '../../src/lib/amountInput';
import {
  EXPENSE_ICON_PALETTE,
  INCOME_ICON_PALETTE,
  colorForIcon,
  colorForIncomeIcon,
} from '../../src/lib/categoryIconPalette';
import { useTheme } from '../../src/theme/ThemeProvider';

// Longer than the other screens' 2500ms -- this screen's delete-blocked toast
// (CATEGORY_IN_USE_MESSAGE below) is a full sentence and needs more time to read than the
// short generic fallback.
const TOAST_DURATION_MS = 4500;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
// removeCategoryFromMonth throws one of these two codes (see docs/SERVICES.md) when the
// category still has real data hanging off it -- surfaced as a specific, actionable message
// instead of the generic fallback, so the user knows exactly what to go delete first.
const CATEGORY_IN_USE_MESSAGE =
  'This category still has transactions or recurring expenses linked to it — delete those first.';

export default function EditCategoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    categoryMonthId: string;
    categoryId: string;
    name: string;
    icon: string;
    color: string;
    budgetType: string;
    direction: string;
    monthlyBudgetCents: string;
  }>();
  const updateBudget = useUpdateCategoryMonthBudget();
  const updateCategory = useUpdateCategory();
  const removeFromMonth = useRemoveCategoryFromMonth();

  const isIncome = params.direction === 'INCOME';

  const [name, setName] = useState(params.name);
  const [icon, setIcon] = useState(params.icon);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [amountText, setAmountText] = useState(() =>
    centsToAmountText(Number(params.monthlyBudgetCents)),
  );
  // The pre-filled amount always has 2 decimal digits already (e.g. "700.00") -- appendDigit
  // and appendDecimalPoint both treat that as "already complete" and refuse to add anything
  // (that guard exists so typing can't add unlimited decimals), which made every digit/decimal
  // press silently do nothing until backspace had cleared past the decimal point first. The
  // first key pressed now clears the pre-filled value and starts fresh, like typing into an
  // empty field; backspace (which has no such guard) is unaffected either way.
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  // Same fix as add/edit-recurring-expense.tsx: the keyboard-dismiss-overlay below is meant
  // only to eat a stray tap-to-dismiss landing on a keypad button underneath, but rendering it
  // the instant the keyboard appears (the same moment the name field is tapped) sat it directly
  // on top of the just-focused native TextInput. Gated on this so it never covers the field
  // currently being typed into.
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

  const iconPalette = isIncome ? INCOME_ICON_PALETTE : EXPENSE_ICON_PALETTE;
  const color = isIncome ? colorForIncomeIcon(icon) : colorForIcon(icon);
  const budgetLabel = isIncome ? 'Expected income' : 'Total budget';
  const canSubmit = !updateBudget.isPending && !updateCategory.isPending && name.trim().length > 0;

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

  async function handleConfirm() {
    if (!canSubmit) return;
    try {
      const trimmedName = name.trim();
      if (trimmedName !== params.name || icon !== params.icon) {
        // CategoryInput is a full replace, not a patch -- every field must be resent even
        // though only the name/icon actually changed here (see docs/PLAN.md).
        await updateCategory.mutateAsync({
          categoryId: params.categoryId,
          name: trimmedName,
          icon,
          color,
          budgetType: (params.budgetType || null) as BudgetType | null,
          direction: params.direction as Direction,
        });
      }
      await updateBudget.mutateAsync({
        categoryMonthId: params.categoryMonthId,
        monthlyBudgetCents: amountTextToCents(amountText),
      });
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  function handleDeletePress() {
    Alert.alert('Delete category', `Delete "${name}" from this month? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDeleteConfirmed },
    ]);
  }

  async function handleDeleteConfirmed() {
    try {
      await removeFromMonth.mutateAsync({ categoryMonthId: params.categoryMonthId });
      router.back();
    } catch (err) {
      if (
        hasGraphqlErrorCode(err, 'CATEGORY_MONTH_HAS_TRANSACTIONS') ||
        hasGraphqlErrorCode(err, 'CATEGORY_MONTH_HAS_RECURRING_EXPENSES')
      ) {
        setToastMessage(CATEGORY_IN_USE_MESSAGE);
      } else {
        setToastMessage(GENERIC_ERROR_MESSAGE);
      }
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <View style={styles.grabberRow}>
        <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.identityRow}>
          <Pressable
            testID="icon-pill"
            style={[styles.iconPill, { backgroundColor: color }]}
            onPress={() => setIconPickerOpen((current) => !current)}
          >
            <CategoryIcon name={icon} color={colors.text.primary} />
            <MaterialCommunityIcons
              name={iconPickerOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.text.primary}
            />
          </Pressable>
          <TextInput
            testID="category-name-input"
            style={[styles.nameInput, { backgroundColor: colors.pill.textInputBackground }]}
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>

        <Text style={[styles.budgetLabel, { color: colors.text.secondary }]}>{budgetLabel}</Text>
        <Text style={styles.amountRow}>
          <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          <Text style={[styles.amountText, { color: colors.text.primary }]}>
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
          testID="delete-category-button"
          style={[styles.deleteButton, { backgroundColor: colors.button.deleteBackground }]}
          onPress={handleDeletePress}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text.onDark} />
          <Text style={[styles.deleteLabel, { color: colors.text.onDark }]}>Delete</Text>
        </Pressable>
      </View>

      {iconPickerOpen ? (
        <>
          <Pressable
            testID="icon-picker-backdrop"
            style={[StyleSheet.absoluteFill, styles.overlayBackdrop]}
            onPress={() => setIconPickerOpen(false)}
          />
          <View
            style={[
              styles.overlayCard,
              { backgroundColor: colors.background.screen, borderColor: colors.segment.track },
            ]}
          >
            <IconPicker
              selectedIcon={icon}
              palette={iconPalette}
              onSelect={(selected) => {
                setIcon(selected);
                setIconPickerOpen(false);
              }}
            />
          </View>
        </>
      ) : null}

      {keyboardVisible && !nameFocused ? (
        // Same reasoning as the Add Category screen's keyboard-dismiss overlay: the first tap
        // outside a focused text input should only dismiss the keyboard, not also register as a
        // real press on whatever's underneath.
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
    gap: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPill: {
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
  budgetLabel: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  amountRow: {
    textAlign: 'center',
    marginBottom: 8,
  },
  currencyPrefix: {
    fontSize: 26,
    fontFamily: 'Fredoka_400Regular',
  },
  amountText: {
    fontSize: 50,
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
  keyboardDismissOverlay: {
    zIndex: 20,
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
});
