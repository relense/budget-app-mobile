import { Pressable, StyleSheet, View } from 'react-native';

import { EXPENSE_ICON_PALETTE } from '../lib/categoryIconPalette';
import { useTheme } from '../theme/ThemeProvider';
import { CategoryIcon } from './CategoryIcon';

// Dark gray rather than pure black -- a plain outline in text.primary read as too harsh/heavy
// against these pastel backgrounds.
const SELECTED_OUTLINE_COLOR = '#4D4D4D';

export function IconPicker({
  selectedIcon,
  onSelect,
  // Defaults to the expense palette so add-category.tsx's existing call site needs no change --
  // add-income.tsx passes INCOME_ICON_PALETTE explicitly.
  palette = EXPENSE_ICON_PALETTE,
}: {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  palette?: { icon: string; color: string }[];
}) {
  const { colors } = useTheme();

  return (
    <View testID="icon-picker-grid" style={styles.grid}>
      {palette.map(({ icon, color }) => {
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
              selected && { borderWidth: 2, borderColor: SELECTED_OUTLINE_COLOR },
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
    // Left-aligned rows left a ragged, sometimes wide gap on the right whenever a row of icons
    // didn't exactly fill the container's width -- centering distributes that leftover space
    // evenly instead, so a partially-filled last row still reads as intentional, not a mistake.
    justifyContent: 'center',
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
