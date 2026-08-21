import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { signOut } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <Text style={{ color: colors.text.primary }}>
        Budget Tracker — scaffold placeholder, screens pending design interview
      </Text>
      <Pressable
        style={[styles.signOutButton, { backgroundColor: colors.segment.active }]}
        onPress={signOut}
      >
        <Text style={{ color: colors.segment.activeText, fontWeight: '600' }}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  signOutButton: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
