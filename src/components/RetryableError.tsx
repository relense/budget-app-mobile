import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

interface RetryableErrorProps {
  message: string;
  onRetry: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function RetryableError({ message, onRetry, testID, style }: RetryableErrorProps) {
  const { colors } = useTheme();

  return (
    <View testID={testID} style={[styles.container, style]}>
      <Text style={[styles.message, { color: colors.button.deleteBackground }]}>{message}</Text>
      <Pressable
        testID="retry-button"
        style={[styles.button, { backgroundColor: colors.segment.active }]}
        onPress={onRetry}
      >
        <Text style={[styles.buttonLabel, { color: colors.segment.activeText }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  message: {
    textAlign: 'center',
    fontSize: 14,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
