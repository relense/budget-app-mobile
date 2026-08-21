import { Pressable, StyleSheet, View } from 'react-native';

import { EXPENSE_ICON_PALETTE } from '../lib/categoryIconPalette';
import { useTheme } from '../theme/ThemeProvider';
import { CategoryIcon } from './CategoryIcon';

export function IconPicker({
  selectedIcon,
  onSelect,
}: {
  selectedIcon: string;
  onSelect: (icon: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      {EXPENSE_ICON_PALETTE.map(({ icon, color }) => {
        const selected = icon === selectedIcon;
        return (
          <Pressable
            key={icon}
            testID={`icon-option-${icon}`}
            onPress={() => onSelect(icon)}
            style={[
              styles.circle,
              { backgroundColor: color },
              // An outline instead of a solid fill on selection -- filling the circle with a
              // different color made it look like *that* was the color being chosen, when the
              // color is actually fixed per icon and never independently pickable.
              selected && { borderWidth: 2, borderColor: colors.text.primary },
            ]}
          >
            <CategoryIcon name={icon} color={colors.text.primary} size={20} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
