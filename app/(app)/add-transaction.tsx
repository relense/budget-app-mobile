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
import { useCreateTransaction } from '../../src/api/transactionMutations';
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
  dayDigitsToIso,
  formatMonthYearLabel,
  formatTypedDay,
  isoDateToDayDigits,
} from '../../src/lib/dateInput';
import { todayIsoDate } from '../../src/lib/today';
import { useTheme } from '../../src/theme/ThemeProvider';

type Overlay = 'none' | 'categoryList';

const CATALOG_LOAD_ERROR = "Couldn't load your budget categories for this transaction.";

export default function AddTransactionScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;
  const expenseCategoryMonths = useCategoryMonths(month, 'EXPENSE');
  const createTransaction = useCreateTransaction();

  const [selectedCategoryMonthId, setSelectedCategoryMonthId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [merchant, setMerchant] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayIsoDate());
  // Whether the user has picked a day themselves via the date-mode keypad -- see
  // effectiveDate below.
  const [dateTouched, setDateTouched] = useState(false);
  const [dateMode, setDateMode] = useState(false);
  const [dayDigits, setDayDigits] = useState('');
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Today's real date is only a valid default while it actually falls within the current
  // active month -- e.g. if the previous month hasn't been locked yet, "today" could be in a
  // later calendar month than the one every categoryMonthId here actually belongs to. Falls
  // back to the 1st of the active month instead, unless the user has picked a day themselves.
  const effectiveDate =
    !dateTouched && month && todayIsoDate().slice(0, 7) !== month ? `${month}-01` : transactionDate;

  const isCatalogLoading = currentMonthQuery.isLoading || expenseCategoryMonths.isLoading;
  const isCatalogError = currentMonthQuery.isError || expenseCategoryMonths.isError;
  const catalogReady = !isCatalogLoading && !isCatalogError && !!month;

  const categoryMonths = expenseCategoryMonths.data ?? [];
  const selectedCategoryMonth =
    categoryMonths.find((cm) => cm.id === selectedCategoryMonthId) ?? categoryMonths[0] ?? null;

  const canSubmit = !!selectedCategoryMonth && amountTextToCents(amountText) > 0 && !createTransaction.isPending;

  // Typed-so-far while in date mode; falls back to the currently committed day (formatted the
  // same way) before any digit is pressed, so switching into date mode shows a real day
  // immediately instead of a blank field -- see mockups/Shopping calendar pressed.png. Month
  // and year are always the fixed current month, shown alongside but never typed.
  const dayDisplayText =
    dayDigits === '' ? isoDateToDayDigits(effectiveDate) : formatTypedDay(dayDigits);

  function handleDigit(digit: string) {
    if (dateMode) {
      if (month) setDayDigits((digits) => appendDayDigit(digits, digit, month));
    } else {
      setAmountText((text) => appendDigit(text, digit));
    }
  }

  function handleDecimalPoint() {
    if (dateMode) return; // dates have no decimal segment
    setAmountText((text) => appendDecimalPoint(text));
  }

  function handleBackspace() {
    if (dateMode) {
      setDayDigits((digits) => backspaceDay(digits));
    } else {
      setAmountText((text) => backspaceAmount(text));
    }
  }

  function handleToggleDateMode() {
    if (dateMode) {
      // A "0" or empty buffer is discarded (day guard already keeps every other state a real
      // day in this month), leaving the previous date in place.
      const iso = month ? dayDigitsToIso(dayDigits, month) : null;
      if (iso) {
        setTransactionDate(iso);
        setDateTouched(true);
      }
      setDayDigits('');
      setDateMode(false);
    } else {
      setDayDigits('');
      setDateMode(true);
    }
  }

  // Confirm can be pressed while still in date mode (the user typed a day but didn't tap the
  // calendar key to leave it) -- fall back to whatever's typed so far instead of silently
  // discarding it in favor of the previously committed date.
  function commitDate(): string {
    if (dateMode && month) {
      const iso = dayDigitsToIso(dayDigits, month);
      if (iso) return iso;
    }
    return effectiveDate;
  }

  async function handleConfirm() {
    if (!canSubmit || !selectedCategoryMonth) return;

    try {
      await createTransaction.mutateAsync({
        categoryMonthId: selectedCategoryMonth.id,
        amountCents: amountTextToCents(amountText),
        date: commitDate(),
        merchant: merchant.trim() || null,
      });
      router.back();
    } catch {
      // createTransaction.isError drives the inline error message below.
    }
  }

  if (isCatalogError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.segment.track }]} />
        </View>
        <View testID="add-transaction-error" style={[styles.centered, { flex: 1 }]}>
          <RetryableError
            message={CATALOG_LOAD_ERROR}
            onRetry={() => {
              currentMonthQuery.refetch();
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
        <View testID="add-transaction-loading" style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      </View>
    );
  }

  if (categoryMonths.length === 0) {
    return (
      <View
        testID="add-transaction-empty"
        style={[styles.container, styles.centered, { backgroundColor: colors.background.screen }]}
      >
        <Text style={[typography.scale.listSubtitle, { color: colors.text.secondary }]}>
          No budget categories yet this month.
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
        <Pressable
          testID="category-pill"
          style={[styles.categoryPill, { backgroundColor: selectedCategoryMonth!.category.color }]}
          onPress={() => setOverlay((current) => (current === 'categoryList' ? 'none' : 'categoryList'))}
        >
          <CategoryIcon name={selectedCategoryMonth!.category.icon} color={colors.text.primary} />
          <Text style={[styles.categoryPillLabel, { color: colors.text.primary }]}>
            {selectedCategoryMonth!.category.name}
          </Text>
          <MaterialCommunityIcons
            name={overlay === 'categoryList' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.text.primary}
          />
        </Pressable>

        <Text style={styles.amountRow}>
          {dateMode ? null : (
            <Text style={[styles.currencyPrefix, { color: colors.text.secondary }]}>€</Text>
          )}
          <Text
            testID="calculator-value"
            style={[typography.scale.calculatorAmount, { color: colors.text.primary }]}
          >
            {dateMode ? `${dayDisplayText} ${formatMonthYearLabel(month!)}` : amountText || '0'}
          </Text>
        </Text>

        <TextInput
          testID="transaction-merchant-input"
          style={[typography.scale.placeholder, styles.merchantInput, { color: colors.text.primary }]}
          placeholder="Add description..."
          placeholderTextColor={colors.text.placeholder}
          value={merchant}
          onChangeText={setMerchant}
        />

        {createTransaction.isError ? (
          <Text style={[styles.errorText, { color: colors.button.deleteBackground }]}>
            Something went wrong. Please try again.
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
            onToggleDateMode={handleToggleDateMode}
          />
        </View>
      </View>

      {overlay === 'categoryList' ? (
        <>
          <Pressable
            testID="category-picker-backdrop"
            style={[StyleSheet.absoluteFill, styles.overlayBackdrop]}
            onPress={() => setOverlay('none')}
          />
          <View
            style={[
              styles.overlayCard,
              { backgroundColor: colors.background.screen, borderColor: colors.segment.track },
            ]}
          >
            <ScrollView style={styles.categoryListScroll}>
              <ExistingCategoryPicker
                categories={categoryMonths.map((cm) => cm.category)}
                onSelectExisting={(category) => {
                  const match = categoryMonths.find((cm) => cm.category.id === category.id);
                  if (match) setSelectedCategoryMonthId(match.id);
                  setOverlay('none');
                }}
              />
            </ScrollView>
          </View>
        </>
      ) : null}

      {keyboardVisible ? (
        // Same reasoning as add-category.tsx: eats the very first tap outside the text input
        // while the keyboard is up, since dismissing it and pressing a keypad key underneath
        // otherwise both register from the same touch.
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
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  categoryPillLabel: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: 'Fredoka_400Regular',
  },
  amountRow: {
    textAlign: 'center',
    marginTop: 8,
  },
  currencyPrefix: {
    fontSize: 26,
    fontFamily: 'Fredoka_400Regular',
  },
  merchantInput: {
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
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
