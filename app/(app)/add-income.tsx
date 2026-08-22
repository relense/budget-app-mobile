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

import { useCategoryMonths, useCurrentMonth } from '../../src/api/budgetHomeQueries';
import {
  useAddCategoryToMonth,
  useCreateIncomeCategoryWithBudget,
} from '../../src/api/categoryMutations';
import { useCategories } from '../../src/api/categoryQueries';
import type { Category } from '../../src/api/types';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ExistingCategoryPicker } from '../../src/components/ExistingCategoryPicker';
import { IconPicker } from '../../src/components/IconPicker';
import { RetryableError } from '../../src/components/RetryableError';
import { Toast } from '../../src/components/Toast';
import {
  amountTextToCents,
  appendDecimalPoint,
  appendDigit,
  backspaceAmount,
} from '../../src/lib/amountInput';
import { INCOME_ICON_PALETTE, colorForIncomeIcon } from '../../src/lib/categoryIconPalette';
import { useTheme } from '../../src/theme/ThemeProvider';
import { filterUnusedCategories, isDuplicateCategoryName } from '../../src/lib/unusedCategories';

type CategoryMode = 'undecided' | 'new' | 'existing';
type Overlay = 'none' | 'icons' | 'existingList';

const TOAST_DURATION_MS = 2500;
const CATALOG_LOAD_ERROR = "Couldn't load your income categories.";

// Mirrors add-category.tsx's existing-vs-create-category flow, minus the Need/Want/Savings
// picker (not meaningful for income, see docs/PLAN.md) -- everything else (icon picker, name,
// amount keypad, duplicate-name guard) is the same shape, scoped to INCOME-direction
// categories throughout.
export default function AddIncomeScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;
  const categoriesQuery = useCategories();
  const incomeCategoryMonths = useCategoryMonths(month, 'INCOME');
  const createCategory = useCreateIncomeCategoryWithBudget();
  const addExisting = useAddCategoryToMonth();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(INCOME_ICON_PALETTE[0].icon);
  const [amountText, setAmountText] = useState('');
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('undecided');
  const [selectedExisting, setSelectedExisting] = useState<Category | null>(null);
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

  const isCatalogLoading =
    currentMonthQuery.isLoading || categoriesQuery.isLoading || incomeCategoryMonths.isLoading;
  const isCatalogError =
    currentMonthQuery.isError || categoriesQuery.isError || incomeCategoryMonths.isError;
  const catalogReady = !isCatalogLoading && !isCatalogError && !!month;
  const unusedCategories = filterUnusedCategories(
    categoriesQuery.data ?? [],
    incomeCategoryMonths.data ?? [],
    'INCOME',
  );
  const resolvedMode: CategoryMode =
    categoryMode !== 'undecided' ? categoryMode : unusedCategories.length > 0 ? 'undecided' : 'new';

  const isExisting = resolvedMode === 'existing' && !!selectedExisting;
  const displayIcon = isExisting ? selectedExisting.icon : icon;
  const displayColor = colorForIncomeIcon(displayIcon);
  const displayName = isExisting ? selectedExisting.name : name;

  const isPending = createCategory.isPending || addExisting.isPending;
  const isError = createCategory.isError || addExisting.isError;
  const canSubmit =
    catalogReady &&
    !isPending &&
    (isExisting ? true : resolvedMode === 'new' ? name.trim().length > 0 : false);

  function handleSelectExisting(category: Category) {
    setSelectedExisting(category);
    setCategoryMode('existing');
    setOverlay('none');
  }

  async function handleConfirm() {
    if (!canSubmit || !month) return;

    if (isExisting) {
      try {
        await addExisting.mutateAsync({
          categoryId: selectedExisting.id,
          month,
          monthlyBudgetCents: amountTextToCents(amountText),
        });
        router.back();
      } catch {
        // addExisting.isError drives the inline error message below.
      }
      return;
    }

    if (isDuplicateCategoryName(categoriesQuery.data ?? [], name, 'INCOME')) {
      setToastMessage('Income category already exists');
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: name.trim(),
        icon,
        color: colorForIncomeIcon(icon),
        month,
        monthlyBudgetCents: amountTextToCents(amountText),
      });
      router.back();
    } catch {
      // createCategory.isError drives the inline error message below.
    }
  }

  if (isCatalogError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
        </View>
        <View testID="add-income-error" style={[styles.centered, { flex: 1 }]}>
          <RetryableError
            message={CATALOG_LOAD_ERROR}
            onRetry={() => {
              currentMonthQuery.refetch();
              categoriesQuery.refetch();
              if (month) incomeCategoryMonths.refetch();
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
        <View testID="add-income-loading" style={[styles.centered, { flex: 1 }]}>
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
        {resolvedMode === 'undecided' ? (
          <View style={styles.identityRow}>
            <Pressable
              testID="choose-existing-button"
              style={[styles.choiceButton, { backgroundColor: colors.category.green.background }]}
              onPress={() => setOverlay('existingList')}
            >
              <Text style={[styles.choiceButtonLabel, { color: colors.text.primary }]}>
                Select Income
              </Text>
            </Pressable>
            <Pressable
              testID="choose-new-button"
              style={[styles.choiceButton, { backgroundColor: colors.pill.textInputBackground }]}
              onPress={() => setCategoryMode('new')}
            >
              <Text style={[styles.choiceButtonLabel, { color: colors.text.primary }]}>
                Create Income
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.identityRow}>
            {(resolvedMode === 'new' || isExisting) && unusedCategories.length > 0 ? (
              <Pressable
                testID="back-to-choice"
                style={styles.backButton}
                onPress={() => {
                  setCategoryMode('undecided');
                  setSelectedExisting(null);
                  setName('');
                  setIcon(INCOME_ICON_PALETTE[0].icon);
                }}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text.primary} />
              </Pressable>
            ) : null}
            <Pressable
              testID="icon-pill"
              style={[styles.iconPill, { backgroundColor: displayColor }]}
              disabled={isExisting}
              onPress={() => setOverlay((current) => (current === 'icons' ? 'none' : 'icons'))}
            >
              <CategoryIcon name={displayIcon} color={colors.text.primary} />
              {isExisting ? null : (
                <MaterialCommunityIcons
                  name={overlay === 'icons' ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.text.primary}
                />
              )}
            </Pressable>
            <TextInput
              testID="income-name-input"
              style={[styles.nameInput, { backgroundColor: colors.pill.textInputBackground }]}
              placeholder="Income name"
              placeholderTextColor={colors.text.secondary}
              value={displayName}
              editable={!isExisting}
              onChangeText={setName}
            />
          </View>
        )}

        <Text
          style={[
            typography.scale.listSubtitle,
            styles.budgetLabel,
            { color: colors.text.secondary },
          ]}
        >
          Expected income
        </Text>
        <Text style={styles.amountRow}>
          <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          <Text style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}>
            {amountText || '0'}
          </Text>
        </Text>

        {isError ? (
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

      {overlay !== 'none' ? (
        <>
          <Pressable
            testID="icon-picker-backdrop"
            style={[StyleSheet.absoluteFill, styles.overlayBackdrop]}
            onPress={() => setOverlay('none')}
          />
          <View
            style={[
              styles.overlayCard,
              { backgroundColor: colors.background.screen, borderColor: colors.segment.track },
            ]}
          >
            {overlay === 'existingList' ? (
              <ScrollView style={styles.existingListScroll}>
                <ExistingCategoryPicker
                  categories={unusedCategories}
                  onSelectExisting={handleSelectExisting}
                />
              </ScrollView>
            ) : (
              <IconPicker
                selectedIcon={icon}
                palette={INCOME_ICON_PALETTE}
                onSelect={(selected) => {
                  setIcon(selected);
                  setOverlay('none');
                }}
              />
            )}
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
  choiceButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonLabel: {
    fontSize: 15,
    fontFamily: 'Fredoka_400Regular',
  },
  backButton: {
    width: 20,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
  existingListScroll: {
    maxHeight: 260,
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
