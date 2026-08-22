import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category } from '../api/types';
import { colorForIcon } from '../lib/categoryIconPalette';
import { useTheme } from '../theme/ThemeProvider';
import { CategoryIcon } from './CategoryIcon';

// A plain list of catalog categories not yet active this month (see
// filterUnusedExpenseCategories) -- lets the user reuse one instead of always creating a new,
// potentially-duplicate category. Rendered inside a ScrollView by the screen that owns it,
// since the catalog can be long; "create a new category instead" is a separate, top-level
// choice on that screen, not a row in this list.
export function ExistingCategoryPicker({
  categories,
  onSelectExisting,
}: {
  categories: Category[];
  onSelectExisting: (category: Category) => void;
}) {
  const { colors } = useTheme();

  // Sorted here rather than by each caller -- the backend doesn't guarantee any particular
  // order, and a picker list is easiest to scan alphabetically regardless of which screen it's
  // shown from.
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View>
      {sortedCategories.map((category) => (
        <Pressable
          key={category.id}
          testID={`existing-category-${category.id}`}
          style={styles.row}
          onPress={() => onSelectExisting(category)}
        >
          {/* Uses the same icon -> color palette as the "create new" icon picker, not the
              category's own stored color -- a catalog entry can carry an old/inconsistent hex
              (e.g. from before this palette existed), and this list should look consistent with
              the rest of this screen regardless of what's actually saved for it. */}
          <View style={[styles.iconCircle, { backgroundColor: colorForIcon(category.icon) }]}>
            <CategoryIcon name={category.icon} color={colors.text.primary} size={20} />
          </View>
          <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
            {category.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Fredoka_400Regular',
  },
});
