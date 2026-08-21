import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

const KEY_ICON_SIZE = 31;

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

// Presentational numeric keypad shared across every amount-entry flow (add category budget,
// add expense, add recurring expense, savings deposit/withdraw -- see mockups/*.png). Only
// digits/decimal/backspace/confirm are wired here; the "€" key is currently a static visual
// key (no flow needs it to do anything yet -- e.g. sign-toggling for deposit/withdraw isn't
// built). There's no calendar/date key slot yet since no consumer needs one so far -- confirm
// simply takes up that space (spans 3 of the 4 rows, delete takes the 4th) instead of leaving
// it blank. Every key sizes itself via flex (no fixed dimensions), so the whole grid grows or
// shrinks with however much space its container gives it.
export function AmountKeypad({
  onDigit,
  onDecimalPoint,
  onBackspace,
  onConfirm,
  confirmDisabled = false,
}: {
  onDigit: (digit: string) => void;
  onDecimalPoint: () => void;
  onBackspace: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}) {
  const { colors, typography } = useTheme();

  return (
    <View style={styles.grid}>
      <View style={styles.digitColumns}>
        {DIGIT_ROWS.map((row) => (
          <View key={row.join('')} style={styles.row}>
            {row.map((digit) => (
              <Pressable
                key={digit}
                testID={`keypad-digit-${digit}`}
                style={[styles.key, { backgroundColor: colors.keypad.digitBackground }]}
                onPress={() => onDigit(digit)}
              >
                <Text style={[typography.scale.keypadDigit, { color: colors.keypad.digitText }]}>
                  {digit}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.row}>
          <View
            testID="keypad-currency"
            style={[styles.key, { backgroundColor: colors.keypad.currencyKeyBackground }]}
          >
            <Text style={[typography.scale.keypadDigit, { color: colors.keypad.digitText }]}>
              €
            </Text>
          </View>
          <Pressable
            testID="keypad-digit-0"
            style={[styles.key, { backgroundColor: colors.keypad.digitBackground }]}
            onPress={() => onDigit('0')}
          >
            <Text style={[typography.scale.keypadDigit, { color: colors.keypad.digitText }]}>
              0
            </Text>
          </Pressable>
          <Pressable
            testID="keypad-decimal-point"
            style={[styles.key, { backgroundColor: colors.keypad.digitBackground }]}
            onPress={onDecimalPoint}
          >
            <Text style={[typography.scale.keypadDigit, { color: colors.keypad.digitText }]}>
              .
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.actionColumn}>
        <Pressable
          testID="keypad-backspace"
          style={[styles.key, { backgroundColor: colors.keypad.deleteKeyBackground }]}
          onPress={onBackspace}
        >
          <MaterialCommunityIcons
            name="backspace-outline"
            size={KEY_ICON_SIZE}
            color={colors.text.primary}
          />
        </Pressable>
        <Pressable
          testID="keypad-confirm"
          disabled={confirmDisabled}
          style={[
            styles.confirmKey,
            {
              backgroundColor: colors.keypad.confirmKeyBackground,
              opacity: confirmDisabled ? 0.4 : 1,
            },
          ]}
          onPress={onConfirm}
        >
          <MaterialCommunityIcons
            name="check"
            size={KEY_ICON_SIZE}
            color={colors.keypad.confirmIcon}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  digitColumns: {
    flex: 3,
    gap: 8,
  },
  actionColumn: {
    flex: 1,
    gap: 8,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmKey: {
    flex: 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
