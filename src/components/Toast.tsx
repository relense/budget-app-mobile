import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

// Deliberately no animation/library -- a plain absolute-positioned banner. The screen that
// renders this owns the auto-dismiss timer (clearing `message` back to null after a delay);
// this component just renders whatever it's given, or nothing at all.
export function Toast({ message }: { message: string | null }) {
  const { colors } = useTheme();

  if (!message) return null;

  return (
    <View style={styles.toast}>
      <Text style={[styles.text, { color: colors.text.primary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    // The original full-width banner, just inset 3px further in on each side than before
    // (24 -> 27) -- that's the actual "3px each side smaller" ask; the earlier attempts either
    // changed internal padding (invisible, since left/right pinned the outer width regardless)
    // or shrink-wrapped to the text (too small).
    left: 27,
    right: 27,
    // Pastel red, matching this app's icon palette (the "heart" icon's tone) -- signals "this
    // went wrong" without needing a harsher solid red, consistent with every other pastel
    // surface in this screen.
    backgroundColor: '#F3C8C8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 30,
    // elevation covers Android's shadow; the shadow* props cover iOS -- neither platform
    // reads the other's, so both are needed for the toast to actually lift off the UI behind
    // it instead of just sitting flush against it.
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
