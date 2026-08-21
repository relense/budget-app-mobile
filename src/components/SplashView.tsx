import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Logo } from './Logo';

// Shown for the duration of AuthContext's bootstrap (silent refresh) check, right after the
// native splash screen (app.config.ts, solid mint-green, no image yet) hands off to JS --
// same background color, so there's no visible handoff flash.
export function SplashView() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background.headerAccent }]}>
      <Logo />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
