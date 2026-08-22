import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { useTheme } from '../theme/ThemeProvider';

const SPACER_WIDTH = 12;
const EDIT_ACTION_WIDTH = 72;
// Total width of the revealed action pane -- used to make the action translate in step with
// the drag instead of just being uncovered in place.
const ACTION_WIDTH = SPACER_WIDTH + EDIT_ACTION_WIDTH;

// Swipe-left-to-reveal-Edit, wrapping any row content. Only one action for now (Edit) --
// delete lives inside the edit screen itself, not as a second swipe action, per the mockups.
//
// The row is deliberately left open (not explicitly closed) when Edit is pressed -- the edit
// screen covers it immediately, and the caller resets/remounts this row (e.g. via a `key` tied
// to screen focus) once the user comes back, so it's reset to closed with no visible animation
// instead of an animated close racing the screen transition in either direction.
export function SwipeableRow({
  onEdit,
  testID,
  children,
}: {
  onEdit: () => void;
  // Multiple rows render at once, each needing its own unique action testID -- callers pass
  // e.g. `swipe-edit-action-${cm.id}` rather than every row sharing one fixed id.
  testID: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  // Guards against a double-tap pushing the edit screen twice before the first navigation lands.
  const hasPressedRef = useRef(false);

  return (
    <Swipeable
      renderRightActions={(_progress, dragX) => {
        // Tie the action pane's position to the drag itself (rather than leaving it static and
        // merely uncovered) so it slides out with your finger and slides back with the row on
        // an incomplete swipe, instead of popping in/out of place.
        const translateX = dragX.interpolate({
          inputRange: [-ACTION_WIDTH, 0],
          outputRange: [0, ACTION_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View style={[styles.actionContainer, { transform: [{ translateX }] }]}>
            {/* Screen-colored spacer so the row isn't glued directly to the action button. */}
            <View style={[styles.spacer, { backgroundColor: colors.background.screen }]} />
            <Pressable
              testID={testID}
              style={[styles.editAction, { backgroundColor: colors.background.headerAccent }]}
              onPress={() => {
                if (hasPressedRef.current) {
                  return;
                }
                hasPressedRef.current = true;
                onEdit();
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.text.primary} />
              <Text style={[styles.editLabel, { color: colors.text.primary }]}>Edit</Text>
            </Pressable>
          </Animated.View>
        );
      }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionContainer: {
    flexDirection: 'row',
  },
  spacer: {
    width: SPACER_WIDTH,
  },
  editAction: {
    width: EDIT_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
