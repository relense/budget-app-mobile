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
import type { BudgetType, Direction } from '../../src/api/types';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { Toast } from '../../src/components/Toast';
import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
} from '../../src/lib/amountInput';
import { colorForIcon } from '../../src/lib/categoryIconPalette';
import { useTheme } from '../../src/theme/ThemeProvider';

const TOAST_DURATION_MS = 2500;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Bare cents-string -> raw keypad text (e.g. 70000 -> "700.00") so the keypad starts pre-filled
// with the category's current budget rather than empty.
function centsToAmountText(cents: number): string {
  return (cents / 100).toFixed(2);
}

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

  const [name, setName] = useState(params.name);
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

  const color = colorForIcon(params.icon);
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
      if (trimmedName !== params.name) {
        // CategoryInput is a full replace, not a patch -- every field must be resent even
        // though only the name actually changed here (see docs/PLAN.md).
        await updateCategory.mutateAsync({
          categoryId: params.categoryId,
          name: trimmedName,
          icon: params.icon,
          color: params.color,
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
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <View style={styles.grabberRow}>
        <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.identityRow}>
          <View style={[styles.iconPill, { backgroundColor: color }]}>
            <CategoryIcon name={params.icon} color={colors.text.primary} />
          </View>
          <TextInput
            testID="category-name-input"
            style={[styles.nameInput, { backgroundColor: colors.pill.textInputBackground }]}
            value={name}
            onChangeText={setName}
          />
        </View>

        <Text style={[styles.budgetLabel, { color: colors.text.secondary }]}>Total budget</Text>
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

      {keyboardVisible ? (
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
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
});
