import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export function AddRow({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: colors.category.green.background }]}>
        <MaterialCommunityIcons name="plus" size={26} color={colors.category.green.icon} />
      </View>
      <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
    </Pressable>
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
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
