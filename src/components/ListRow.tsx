import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export function ListRow({
  icon,
  circleColor,
  title,
  subtitle,
  amountText,
  secondaryAmountText,
  // When given, the icon circle itself becomes a tappable target, independent of any
  // row-level or swipe action (see the Recurrent tab's icon-tap-to-pay on Home) -- omitted
  // entirely (not just disabled) means a plain, non-interactive View, unchanged for every
  // other call site.
  onIconPress,
  iconTestID,
}: {
  icon: ReactNode;
  circleColor: string;
  title: string;
  subtitle?: string;
  amountText: string;
  secondaryAmountText?: string;
  onIconPress?: () => void;
  iconTestID?: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {onIconPress ? (
        <Pressable
          testID={iconTestID}
          style={[styles.iconCircle, { backgroundColor: circleColor }]}
          onPress={onIconPress}
        >
          {icon}
        </Pressable>
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: circleColor }]}>{icon}</View>
      )}
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.amountColumn}>
        <Text style={[styles.amount, { color: colors.text.primary }]}>{amountText}</Text>
        {secondaryAmountText ? (
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {secondaryAmountText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  amountColumn: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
});
