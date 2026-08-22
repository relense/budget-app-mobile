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
  useCreateCategoryWithBudget,
} from '../../src/api/categoryMutations';
import { useCategories } from '../../src/api/categoryQueries';
import type { BudgetType, Category } from '../../src/api/types';
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
import { colorForIcon } from '../../src/lib/categoryIconPalette';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  filterUnusedExpenseCategories,
  isDuplicateCategoryName,
} from '../../src/lib/unusedCategories';

const BUDGET_TYPES: { key: BudgetType; label: string }[] = [
  { key: 'NEED', label: 'Need' },
  { key: 'WANT', label: 'Want' },
  { key: 'SAVINGS', label: 'Savings' },
];

type CategoryMode = 'undecided' | 'new' | 'existing';
type Overlay = 'none' | 'icons' | 'existingList';

const TOAST_DURATION_MS = 2500;
const CATALOG_LOAD_ERROR = "Couldn't load your category catalog.";

export default function AddCategoryScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;
  const categoriesQuery = useCategories();
  const expenseCategoryMonths = useCategoryMonths(month, 'EXPENSE');
  const createCategory = useCreateCategoryWithBudget();
  const addExisting = useAddCategoryToMonth();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('cart');
  const [budgetType, setBudgetType] = useState<BudgetType>('NEED');
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

  // `useCategories` is only ever called from this screen, unlike `useCategoryMonths` (which
  // Home already warms the cache for) -- without this gate, the catalog query's first-render
  // `undefined` defaults to an empty array, so `unusedCategories` is briefly computed as empty
  // regardless of the real catalog. That both flips the screen from form -> choice mid-
  // interaction once the real data lands, and -- more seriously -- lets the duplicate-name
  // guard below be bypassed if the user confirms before this query resolves.
  //
  // isError is checked separately from isLoading, not folded into one flag -- in react-query
  // v5, a failed query has isLoading: false with data still undefined, the exact same "resolved
  // but empty" shape the loading race above exploited. Without this, a failed fetch would silently
  // reopen that same duplicate-guard bypass instead of surfacing an error.
  const isCatalogLoading =
    currentMonthQuery.isLoading || categoriesQuery.isLoading || expenseCategoryMonths.isLoading;
  const isCatalogError =
    currentMonthQuery.isError || categoriesQuery.isError || expenseCategoryMonths.isError;
  const catalogReady = !isCatalogLoading && !isCatalogError && !!month;
  const unusedCategories = filterUnusedExpenseCategories(
    categoriesQuery.data ?? [],
    expenseCategoryMonths.data ?? [],
  );
  // If there's nothing to choose from, skip the choice entirely -- behaves exactly as it did
  // before this feature existed. Otherwise wait for the user to pick a path explicitly.
  const resolvedMode: CategoryMode =
    categoryMode !== 'undecided' ? categoryMode : unusedCategories.length > 0 ? 'undecided' : 'new';

  const isExisting = resolvedMode === 'existing' && !!selectedExisting;
  const displayIcon = isExisting ? selectedExisting.icon : icon;
  // Always derived from the icon, never the category's own stored color -- an existing
  // catalog entry can carry an old/inconsistent hex, and this pill should match what was just
  // shown for it in the existing-category list (which also uses colorForIcon).
  const displayColor = colorForIcon(displayIcon);
  const displayName = isExisting ? selectedExisting.name : name;
  const displayBudgetType = isExisting ? selectedExisting.budgetType : budgetType;

  const isPending = createCategory.isPending || addExisting.isPending;
  const isError = createCategory.isError || addExisting.isError;
  // Disabled until the user has picked a category one way or another -- the budget amount
  // itself can always be typed in the meantime, only confirming is gated.
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

    if (isDuplicateCategoryName(categoriesQuery.data ?? [], name)) {
      setToastMessage('Category already exists');
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: name.trim(),
        icon,
        color: colorForIcon(icon),
        budgetType,
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
        <View testID="add-category-error" style={[styles.centered, { flex: 1 }]}>
          <RetryableError
            message={CATALOG_LOAD_ERROR}
            onRetry={() => {
              currentMonthQuery.refetch();
              categoriesQuery.refetch();
              // expenseCategoryMonths is gated on `month` being known (enabled: !!month) -- only
              // worth refetching once there's a month to scope it to.
              if (month) expenseCategoryMonths.refetch();
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
        <View testID="add-category-loading" style={[styles.centered, { flex: 1 }]}>
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
                Select Category
              </Text>
            </Pressable>
            <Pressable
              testID="choose-new-button"
              style={[styles.choiceButton, { backgroundColor: colors.pill.textInputBackground }]}
              onPress={() => setCategoryMode('new')}
            >
              <Text style={[styles.choiceButtonLabel, { color: colors.text.primary }]}>
                Create Category
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
                  // Otherwise a stale name/icon/budget-type from before "back" was pressed
                  // would silently carry over into a fresh "Create New" -- this should start
                  // genuinely blank, not resume whatever was typed the first time around.
                  setName('');
                  setIcon('cart');
                  setBudgetType('NEED');
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
              testID="category-name-input"
              style={[styles.nameInput, { backgroundColor: colors.pill.textInputBackground }]}
              placeholder="Category name"
              placeholderTextColor={colors.text.secondary}
              value={displayName}
              editable={!isExisting}
              onChangeText={setName}
            />
          </View>
        )}

        <View style={[styles.budgetTypeRow, { backgroundColor: colors.segment.track }]}>
          {BUDGET_TYPES.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[
                styles.budgetTypeButton,
                displayBudgetType === key && { backgroundColor: colors.segment.active },
              ]}
              onPress={isExisting ? undefined : () => setBudgetType(key)}
            >
              <Text
                style={[
                  typography.scale.segmentLabel,
                  {
                    color:
                      displayBudgetType === key
                        ? colors.segment.activeText
                        : colors.segment.inactiveText,
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
          Total category budget
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
          {/* Full-screen backdrop, sibling of `content` so it covers the whole screen -- tapping
              anywhere outside the picker closes it, same pattern as the Home screen's header
              metric menu. Overlays on top instead of pushing the rest of the form down. */}
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
