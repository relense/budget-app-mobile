import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { OtpRequestError, requestOtp } from '../../src/auth/authApi';
import { getApiUrl } from '../../src/lib/apiUrl';
import { useTheme } from '../../src/theme/ThemeProvider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setStatus('error');
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);

    try {
      await requestOtp(getApiUrl(), trimmedEmail);
      router.push({ pathname: '/verify', params: { email: trimmedEmail } });
    } catch (err) {
      setStatus('error');
      if (err instanceof OtpRequestError && err.code === 'rate_limited') {
        setErrorMessage('Too many requests — try again in a few minutes.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
      return;
    }
    setStatus('idle');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.headline, { color: colors.text.primary }]}>Log in</Text>
      <Text style={[styles.subtext, { color: colors.text.secondary }]}>
        Enter your email and we&apos;ll send you a one-time code.
      </Text>

      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.pill.textInputBackground, color: colors.text.primary },
        ]}
        placeholder="you@example.com"
        placeholderTextColor={colors.text.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (status === 'error') {
            setStatus('idle');
            setErrorMessage(null);
          }
        }}
        editable={status !== 'submitting'}
        onSubmitEditing={handleSubmit}
      />

      {status === 'error' && errorMessage ? (
        <Text style={[styles.error, { color: colors.button.deleteBackground }]}>
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, { backgroundColor: colors.segment.active }]}
        onPress={handleSubmit}
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? (
          <ActivityIndicator color={colors.segment.activeText} />
        ) : (
          <Text style={[styles.buttonLabel, { color: colors.segment.activeText }]}>Send code</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    marginBottom: 32,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
