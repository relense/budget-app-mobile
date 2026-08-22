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
import { useDeleteTransaction, useUpdateTransaction } from '../../src/api/transactionMutations';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { ExistingCategoryPicker } from '../../src/components/ExistingCategoryPicker';
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
  dayDigitsToIso,
  formatMonthYearLabel,
  formatTypedDay,
  isoDateToDayDigits,
} from '../../src/lib/dateInput';
import { useTheme } from '../../src/theme/ThemeProvider';

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

type Overlay = 'none' | 'categoryList';

export default function EditTransactionScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    transactionId: string;
    categoryMonthId: string;
    amountCents: string;
    date: string;
    merchant: string;
  }>();
  const currentMonthQuery = useCurrentMonth();
  const month = currentMonthQuery.data?.month;
  const expenseCategoryMonths = useCategoryMonths(month, 'EXPENSE');
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const [selectedCategoryMonthId, setSelectedCategoryMonthId] = useState(params.categoryMonthId);
  const [amountText, setAmountText] = useState(() => centsToAmountText(Number(params.amountCents)));
  // Same reasoning as edit-category.tsx: the pre-filled amount already has 2 decimal digits, so
  // the first digit/decimal press replaces it from scratch instead of silently no-op-ing.
  const [hasEditedAmount, setHasEditedAmount] = useState(false);
  const [merchant, setMerchant] = useState(params.merchant ?? '');
  const [transactionDate, setTransactionDate] = useState(params.date);
  const [dateMode, setDateMode] = useState(false);
  const [dayDigits, setDayDigits] = useState('');
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isCatalogLoading = currentMonthQuery.isLoading || expenseCategoryMonths.isLoading;
  const isCatalogError = currentMonthQuery.isError || expenseCategoryMonths.isError;
  const catalogReady = !isCatalogLoading && !isCatalogError && !!month;

  const categoryMonths = expenseCategoryMonths.data ?? [];
  const selectedCategoryMonth =
    categoryMonths.find((cm) => cm.id === selectedCategoryMonthId) ?? categoryMonths[0] ?? null;

  const canSubmit =
    !!selectedCategoryMonth &&
    amountTextToCents(amountText) > 0 &&
    !updateTransaction.isPending &&
    !deleteTransaction.isPending;

  const dayDisplayText =
    dayDigits === '' ? isoDateToDayDigits(transactionDate) : formatTypedDay(dayDigits);

  function handleDigit(digit: string) {
    if (dateMode) {
      if (month) setDayDigits((digits) => appendDayDigit(digits, digit, month));
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
    if (dateMode) return;
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText('0.');
      return;
    }
    setAmountText((text) => appendDecimalPoint(text));
  }

  function handleBackspace() {
    if (dateMode) {
      setDayDigits((digits) => backspaceDay(digits));
      return;
    }
    if (!hasEditedAmount) {
      setHasEditedAmount(true);
      setAmountText('');
      return;
    }
    setAmountText((text) => backspaceAmount(text));
  }

  function handleToggleDateMode() {
    if (dateMode) {
      const iso = month ? dayDigitsToIso(dayDigits, month) : null;
      if (iso) setTransactionDate(iso);
      setDayDigits('');
      setDateMode(false);
    } else {
      setDayDigits('');
      setDateMode(true);
    }
  }

  async function handleConfirm() {
    if (!canSubmit || !selectedCategoryMonth) return;

    try {
      await updateTransaction.mutateAsync({
        transactionId: params.transactionId,
        categoryMonthId: selectedCategoryMonth.id,
        amountCents: amountTextToCents(amountText),
        date: transactionDate,
        merchant: merchant.trim() || null,
      });
      router.back();
    } catch {
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  function handleDeletePress() {
    Alert.alert("Delete transaction", "Delete this transaction? This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDeleteConfirmed },
    ]);
  }

  async function handleDeleteConfirmed() {
    try {
      await deleteTransaction.mutateAsync({ transactionId: params.transactionId });
      router.back();
    } catch {
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  if (isCatalogError) {
    return (
      <View
        testID="edit-transaction-error"
        style={[styles.container, styles.centered, { backgroundColor: colors.background.screen }]}
      >
        <Text style={[styles.errorText, { color: colors.button.deleteBackground }]}>
          Something went wrong loading this. Please try again.
        </Text>
      </View>
    );
  }

  if (!catalogReady) {
    return (
      <View
        testID="edit-transaction-loading"
        style={[styles.container, styles.centered, { backgroundColor: colors.background.screen }]}
      >
        <ActivityIndicator color={colors.text.primary} />
      </View>
    );
  }

  if (!selectedCategoryMonth) {
    return (
      <View
        testID="edit-transaction-empty"
        style={[styles.container, styles.centered, { backgroundColor: colors.background.screen }]}
      >
        <Text style={[typography.scale.listSubtitle, { color: colors.text.secondary }]}>
          No budget categories active this month.
        </Text>
        <Pressable style={styles.emptyBackButton} onPress={() => router.back()}>
          <Text style={[typography.scale.listSubtitle, { color: colors.text.primary }]}>Go back</Text>
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
          style={[styles.categoryPill, { backgroundColor: selectedCategoryMonth.category.color }]}
          onPress={() => setOverlay((current) => (current === 'categoryList' ? 'none' : 'categoryList'))}
        >
          <CategoryIcon name={selectedCategoryMonth.category.icon} color={colors.text.primary} />
          <Text style={[styles.categoryPillLabel, { color: colors.text.primary }]}>
            {selectedCategoryMonth.category.name}
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

        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.button.deleteBackground }]}>
            {errorMessage}
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

        <Pressable
          testID="delete-transaction-button"
          style={[styles.deleteButton, { backgroundColor: colors.button.deleteBackground }]}
          onPress={handleDeletePress}
          disabled={deleteTransaction.isPending || updateTransaction.isPending}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text.onDark} />
          <Text style={[styles.deleteLabel, { color: colors.text.onDark }]}>Delete</Text>
        </Pressable>
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
