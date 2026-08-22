import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCreateTransaction, useDeleteTransaction } from '../../src/api/transactionMutations';
import { AmountKeypad } from '../../src/components/AmountKeypad';
import { CategoryIcon } from '../../src/components/CategoryIcon';
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

const TOAST_DURATION_MS = 2500;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Reached by tapping an Income row on Home (unlike Recurrent, which only reacts to swipe --
// see edit-recurring-expense.tsx). "Received" has no stored field on CategoryMonth: it's
// derived from whether any transaction exists against this row this month
// (actualAmountCents > 0), consistent with the user's description ("add a value which will
// create the transaction"). Editing name/expected-amount/deleting the income category itself
// still lives in edit-category.tsx, reached by swiping the row -- unchanged, generic across
// direction already.
export default function IncomeReceivedScreen() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    categoryMonthId: string;
    name: string;
    icon: string;
    color: string;
    monthlyBudgetCents: string;
    actualAmountCents: string;
    transactionIds: string;
  }>();

  const createTransaction = useCreateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const transactionIds: string[] = params.transactionIds ? JSON.parse(params.transactionIds) : [];
  const received = Number(params.actualAmountCents) > 0;

  const [amountText, setAmountText] = useState(() =>
    centsToAmountText(Number(params.monthlyBudgetCents)),
  );
  // Same "first key clears the pre-filled value" guard as edit-category.tsx/
  // edit-recurring-expense.tsx.
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

  const isMutating = createTransaction.isPending || deleteTransaction.isPending;
  const canSubmit = !isMutating && amountTextToCents(amountText) > 0;

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

  // Adds one more received transaction for the amount currently shown -- repeatable, so a
  // partial/split payment can be topped up with another later in the month.
  async function handleConfirm() {
    if (!canSubmit) return;
    try {
      await createTransaction.mutateAsync({
        categoryMonthId: params.categoryMonthId,
        amountCents: amountTextToCents(amountText),
        date: todayIsoDate(),
        merchant: null,
      });
      router.back();
    } catch {
      setToastMessage(GENERIC_ERROR_MESSAGE);
    }
  }

  // The pill is the quick all-or-nothing toggle: clears every transaction this month when
  // already Received, or records the amount shown when Not received (same action as Confirm).
  async function handleTogglePill() {
    if (isMutating) return;
    try {
      if (received) {
        await Promise.all(
          transactionIds.map((transactionId) => deleteTransaction.mutateAsync({ transactionId })),
        );
        router.back();
      } else {
        await handleConfirm();
      }
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
        <Pressable
          testID="received-pill"
          style={[
            styles.receivedPill,
            {
              backgroundColor: received
                ? colors.status.paid.background
                : colors.status.unpaid.background,
            },
          ]}
          disabled={isMutating}
          onPress={handleTogglePill}
        >
          <Text
            style={[
              typography.scale.segmentLabel,
              { color: received ? colors.status.paid.text : colors.status.unpaid.text },
            ]}
          >
            {received ? 'Received' : 'Not received'}
          </Text>
          {received ? (
            <MaterialCommunityIcons name="check" size={18} color={colors.status.paid.text} />
          ) : null}
        </Pressable>

        <View style={styles.identityRow}>
          <View style={[styles.iconPill, { backgroundColor: params.color }]}>
            <CategoryIcon name={params.icon} color={colors.text.primary} />
          </View>
          <Text style={[typography.scale.listSubtitle, { color: colors.text.primary }]}>
            {params.name}
          </Text>
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
      </View>

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
  receivedPill: {
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
  iconPill: {
    height: 48,
    width: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  currencyPrefix: {
    fontSize: 26,
    fontFamily: 'Fredoka_400Regular',
  },
  keypadWrap: {
    flex: 1,
  },
  keyboardDismissOverlay: {
    zIndex: 20,
  },
});
