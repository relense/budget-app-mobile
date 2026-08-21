import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCreateCategoryWithBudget } from '../../src/api/categoryMutations';
import type { BudgetType } from '../../src/api/types';
import { useCurrentMonth } from '../../src/api/budgetHomeQueries';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { IconPicker } from '../../src/components/IconPicker';
import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
} from '../../src/lib/amountInput';
import { colorForIcon } from '../../src/lib/categoryIconPalette';
import { useTheme } from '../../src/theme/ThemeProvider';

const BUDGET_TYPES: { key: BudgetType; label: string }[] = [
  { key: 'NEED', label: 'Need' },
  { key: 'WANT', label: 'Want' },
  { key: 'SAVINGS', label: 'Savings' },
];

export default function AddCategoryScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: currentMonth } = useCurrentMonth();
  const createCategory = useCreateCategoryWithBudget();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('cart');
  const [budgetType, setBudgetType] = useState<BudgetType>('NEED');
  const [amountText, setAmountText] = useState('');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const color = colorForIcon(icon);
  const canSubmit = name.trim().length > 0 && !!currentMonth?.month && !createCategory.isPending;

  async function handleConfirm() {
    if (!canSubmit || !currentMonth) return;

    try {
      await createCategory.mutateAsync({
        name: name.trim(),
        icon,
        color,
        budgetType,
        month: currentMonth.month,
        monthlyBudgetCents: amountTextToCents(amountText),
      });
      router.back();
    } catch {
      // createCategory.isError drives the inline error message below.
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
            onPress={() => setIconPickerOpen((open) => !open)}
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
            placeholder="Category name"
            placeholderTextColor={colors.text.secondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={[styles.budgetTypeRow, { backgroundColor: colors.segment.track }]}>
          {BUDGET_TYPES.map(({ key, label }) => (
            <Pressable
              key={key}
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

        <Text
          style={[
            typography.scale.listSubtitle,
            styles.budgetLabel,
            { color: colors.text.secondary },
          ]}
        >
          Total budget
        </Text>
        <Text style={styles.amountRow}>
          <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          <Text style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}>
            {amountText || '0'}
          </Text>
        </Text>

        {createCategory.isError ? (
          <Text style={[styles.errorText, { color: colors.button.deleteBackground }]}>
            Something went wrong. Please try again.
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
      </View>

      {iconPickerOpen ? (
        <>
          {/* Full-screen backdrop, sibling of `content` so it covers the whole screen -- tapping
              anywhere outside the picker closes it, same pattern as the Home screen's header
              metric menu. Overlays on top instead of pushing the rest of the form down, and
              closes on either an outside tap or picking an icon (see IconPicker's onSelect). */}
          <Pressable
            testID="icon-picker-backdrop"
            style={[StyleSheet.absoluteFill, styles.iconPickerBackdrop]}
            onPress={() => setIconPickerOpen(false)}
          />
          <View
            style={[
              styles.iconPickerOverlay,
              { backgroundColor: colors.background.screen, borderColor: colors.segment.track },
            ]}
          >
            <IconPicker
              selectedIcon={icon}
              onSelect={(selected) => {
                setIcon(selected);
                setIconPickerOpen(false);
              }}
            />
          </View>
        </>
      ) : null}

      {keyboardVisible ? (
        // Eats the very first tap outside the text input while the keyboard is up: without
        // this, tapping a keypad digit to dismiss the keyboard also registered as a real digit
        // press in the same touch (the OS blurs the input and the button's onPress both fire
        // from one tap). This overlay unmounts the instant the keyboard actually hides, so a
        // second, deliberate tap reaches the real buttons normally.
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
  iconPickerBackdrop: {
    zIndex: 9,
  },
  iconPickerOverlay: {
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
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 8,
  },
  keypadWrap: {
    flex: 1,
  },
  keyboardDismissOverlay: {
    zIndex: 20,
  },
});
