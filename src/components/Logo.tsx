import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export function Logo() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/logo.png')} style={styles.mark} resizeMode="contain" />
      {/* App name still undecided -- placeholder wordmark, see docs/PROGRESS-MOBILE.md */}
      <Text style={[styles.wordmark, { color: colors.text.primary }]}>Budget Tracker</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  mark: {
    width: 88,
    height: 88,
  },
  wordmark: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
  },
});
