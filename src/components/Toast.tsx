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
    // No `left`/`right` here on purpose -- those had pinned the box to a fixed, nearly-full-
    // screen width regardless of padding, which is why shrinking paddingHorizontal never
    // visibly changed anything. alignSelf + maxWidth let the box shrink-wrap to the message
    // instead, so padding actually controls its size now.
    alignSelf: 'center',
    maxWidth: '80%',
    // Pastel red, matching this app's icon palette (the "heart" icon's tone) -- signals "this
    // went wrong" without needing a harsher solid red, consistent with every other pastel
    // surface in this screen.
    backgroundColor: '#F3C8C8',
    borderRadius: 12,
    paddingVertical: 8,
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
