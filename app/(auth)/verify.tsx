import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthContext';
import { OtpRequestError, OtpVerifyError, requestOtp, verifyOtp } from '../../src/auth/authApi';
import type { OtpVerifyErrorCode } from '../../src/auth/authApi';
import { Logo } from '../../src/components/Logo';
import { getApiUrl } from '../../src/lib/apiUrl';
import { useTheme } from '../../src/theme/ThemeProvider';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

const ERROR_MESSAGES: Record<OtpVerifyErrorCode, string> = {
  incorrect_code: "That code doesn't look right. Try again.",
  code_expired: 'This code has expired. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
  code_not_found: "We couldn't find an active code for this email. Request a new one.",
};

export default function VerifyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleVerify(fullCode: string) {
    setStatus('submitting');
    setErrorMessage(null);

    try {
      const result = await verifyOtp(getApiUrl(), { email, code: fullCode });
      await signIn(result);
    } catch (err) {
      setCode('');
      setStatus('error');
      if (err instanceof OtpVerifyError) {
        setErrorMessage(ERROR_MESSAGES[err.code]);
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
      inputRef.current?.focus();
    }
  }

  function handleChangeCode(text: string) {
    if (status === 'submitting') return;
    const nextCode = text.toUpperCase().slice(0, CODE_LENGTH);
    setCode(nextCode);
    if (nextCode.length === CODE_LENGTH) {
      handleVerify(nextCode);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0) return;
    setErrorMessage(null);
    setCode('');
    try {
      await requestOtp(getApiUrl(), email);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setStatus('error');
      if (err instanceof OtpRequestError && err.code === 'rate_limited') {
        setErrorMessage('Too many requests — try again in a few minutes.');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    }
    inputRef.current?.focus();
  }

  const boxes = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');

  return (
    <View style={[styles.container, { backgroundColor: colors.background.screen }]}>
      <View style={[styles.logoWrap, { top: insets.top + 24 }]}>
        <Logo />
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.headline, { color: colors.text.primary }]}>Enter your code</Text>
        <Text style={[styles.subtext, { color: colors.text.secondary }]}>
          We sent a 6-character code to {email}.
        </Text>

        <View style={styles.boxesRow}>
          {boxes.map((char, i) => (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: char
                    ? colors.identity.badgeBackground
                    : colors.background.keypadKey,
                },
                status === 'error' && {
                  borderColor: colors.button.deleteBackground,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[styles.boxText, { color: colors.text.primary }]}>{char}</Text>
            </View>
          ))}
          {/* Overlays the boxes directly so taps land on a real, focusable input -- routing
              taps through a separate Pressable -> ref.focus() proxy was unreliable. Never
              toggle `editable` based on status -- flipping it off during submission and back
              on after an error doesn't reliably restore tap-to-focus on iOS. Re-entrancy while
              submitting is instead guarded inside handleChangeCode itself. */}
          <TextInput
            ref={inputRef}
            style={styles.overlayInput}
            value={code}
            onChangeText={handleChangeCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            autoFocus
          />
        </View>

        {status === 'submitting' ? (
          <ActivityIndicator style={styles.spinner} color={colors.text.primary} />
        ) : null}

        {status === 'error' && errorMessage ? (
          <Text style={[styles.error, { color: colors.button.deleteBackground }]}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={handleResend}
          disabled={secondsLeft > 0}
          style={[
            styles.resendButton,
            {
              backgroundColor: secondsLeft > 0 ? colors.segment.track : colors.segment.active,
            },
          ]}
        >
          <Text
            style={[
              styles.resendLabel,
              { color: secondsLeft > 0 ? colors.segment.inactiveText : colors.segment.activeText },
            ]}
          >
            {secondsLeft > 0
              ? `Resend code in 0:${String(secondsLeft).padStart(2, '0')}`
              : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
  },
  boxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  overlayInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: 22,
    fontWeight: '600',
  },
  spinner: {
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    marginBottom: 12,
  },
  resendButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
