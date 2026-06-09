import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { TextInputProps, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../../components/ui/Logo';
import { Typography } from '../../components/ui/Typography';
import useAuthStore from '../../src/store/authStore';

const palette = {
  background: '#f7fafc',
  card: '#ffffff',
  primary: '#0f1743',
  secondary: '#6f7787',
  outline: '#d7dadc',
  error: '#ba1a1a',
};

type WebAutofillProps = Pick<TextInputProps, 'autoComplete' | 'nativeID'> & {
  dataSet?: Record<string, string>;
};

const webInputReset = Platform.select({
  web: {
    outlineStyle: 'none',
    outlineWidth: 0,
  } as unknown as TextStyle,
  default: {},
});

const emailAutofillProps: WebAutofillProps =
  Platform.OS === 'web'
    ? {
        autoComplete: 'email' as const,
        nativeID: 'lad-login-email',
        dataSet: {
          lpignore: 'true',
          '1pIgnore': 'true',
          formType: 'other',
        },
      }
    : {
        autoComplete: 'email' as const,
      };

const passwordAutofillProps: WebAutofillProps =
  Platform.OS === 'web'
    ? {
        autoComplete: 'current-password' as const,
        nativeID: 'lad-login-password',
        dataSet: {
          lpignore: 'true',
          '1pIgnore': 'true',
          formType: 'other',
        },
      }
    : {
        autoComplete: 'current-password' as const,
      };

export default function LoginScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const signIn = useAuthStore((state) => state.signIn);
  const authError = useAuthStore((state) => state.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPhone = width <= 430;
  const isTinyPhone = width <= 360 || height < 700;
  const isTablet = width >= 768;
  const isMobileLayout = width < 560;
  const isCompact = isPhone || height < 760;
  const horizontalPadding = isTinyPhone ? 16 : isPhone ? 20 : isTablet ? 32 : 24;
  const cardWidth = Math.max(288, Math.min(width - horizontalPadding * 2, isTablet ? 440 : isMobileLayout ? 374 : 410));
  const cardPadding = isTinyPhone ? 18 : isPhone ? 22 : isCompact ? 26 : 36;
  const logoWidth = isTinyPhone ? 94 : isPhone ? 106 : 122;
  const logoHeight = isTinyPhone ? 34 : isPhone ? 38 : 46;
  const titleFontSize = isTinyPhone ? 27 : isPhone ? 30 : isCompact ? 32 : 36;
  const titleLineHeight = Math.round(titleFontSize * 1.2);
  const subtitleFontSize = isTinyPhone ? 15 : isPhone ? 16 : isCompact ? 17 : 19;
  const subtitleLineHeight = Math.round(subtitleFontSize * 1.45);
  const labelFontSize = isTinyPhone ? 14 : isPhone ? 15 : 16;
  const inputHeight = isTinyPhone ? 54 : isPhone ? 58 : 64;
  const inputFontSize = isTinyPhone ? 14 : isPhone ? 15 : 17;
  const submitHeight = isTinyPhone ? 54 : isPhone ? 58 : 64;
  const viewportMinHeight = Math.max(height - insets.top - insets.bottom, 0);
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 0 : 0;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const styleId = 'lad-login-input-reset';
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #lad-login-email,
      #lad-login-password {
        outline: none !important;
        box-shadow: none !important;
        -webkit-appearance: none !important;
        appearance: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

  const scrollForInput = useCallback((target: 'email' | 'password') => {
    const delay = Platform.OS === 'ios' ? 260 : 380;
    setTimeout(() => {
      const y = target === 'password' ? (isTinyPhone ? 82 : 54) : 0;
      scrollRef.current?.scrollTo({ y, animated: true });
    }, delay);
  }, [isTinyPhone]);

  const handleLogin = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      Alert.alert('Login required', 'Enter your email and password to continue.');
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      await signIn({ email: trimmedEmail, password });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Login failed',
        error instanceof Error ? error.message : 'Please check your credentials and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, router, signIn]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isCompact && styles.scrollContentCompact,
            {
              minHeight: viewportMinHeight,
              paddingHorizontal: horizontalPadding,
              paddingTop: isTinyPhone ? 14 : isCompact ? 20 : 30,
              paddingBottom: isTinyPhone ? 20 : isCompact ? 30 : 40,
            },
          ]}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              isCompact && styles.cardCompact,
              isPhone && styles.cardPhone,
              isTinyPhone && styles.cardTinyPhone,
              {
                width: cardWidth,
                paddingHorizontal: cardPadding,
              },
            ]}
          >
            <View style={styles.header}>
              <Logo
                variant="main"
                width={logoWidth}
                height={logoHeight}
                style={[styles.logo, isCompact && styles.logoCompact, isTinyPhone && styles.logoTinyPhone]}
              />
              <Typography
                variant="h1"
                style={[
                  styles.title,
                  {
                    fontSize: titleFontSize,
                    lineHeight: titleLineHeight,
                  },
                ]}
              >
                Welcome Back
              </Typography>
              <Typography
                variant="bodyLarge"
                style={[
                  styles.subtitle,
                  {
                    fontSize: subtitleFontSize,
                    lineHeight: subtitleLineHeight,
                  },
                ]}
              >
                Sign in to continue to LAD.
              </Typography>
            </View>

            <View
              style={[
                styles.form,
                isCompact && styles.formCompact,
                isPhone && styles.formPhone,
                isTinyPhone && styles.formTinyPhone,
              ]}
            >
              <Typography variant="body" style={[styles.fieldLabel, isPhone && styles.fieldLabelPhone, { fontSize: labelFontSize }]}>
                Email Address
              </Typography>
              <Pressable
                style={[styles.inputBox, isPhone && styles.inputBoxPhone, isTinyPhone && styles.inputBoxTinyPhone, { height: inputHeight }]}
                onPress={() => emailRef.current?.focus()}
              >
                <Mail color={palette.secondary} size={isPhone ? 20 : 22} strokeWidth={2} />
                <TextInput
                  ref={emailRef}
                  style={[styles.input, isPhone && styles.inputPhone, isTinyPhone && styles.inputTinyPhone, { fontSize: inputFontSize }, webInputReset]}
                  placeholder="name@company.com"
                  placeholderTextColor={palette.secondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'email-address'}
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                  importantForAutofill="yes"
                  multiline={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  editable={!isSubmitting}
                  onFocus={() => scrollForInput('email')}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  {...emailAutofillProps}
                />
              </Pressable>

              <Typography
                variant="body"
                style={[
                  styles.fieldLabel,
                  styles.passwordLabel,
                  isCompact && styles.passwordLabelCompact,
                  isPhone && styles.fieldLabelPhone,
                  isTinyPhone && styles.passwordLabelTinyPhone,
                  { fontSize: labelFontSize },
                ]}
              >
                Password
              </Typography>
              <Pressable
                style={[styles.inputBox, isPhone && styles.inputBoxPhone, isTinyPhone && styles.inputBoxTinyPhone, { height: inputHeight }]}
                onPress={() => passwordRef.current?.focus()}
              >
                <Lock color={palette.secondary} size={isPhone ? 20 : 22} strokeWidth={2} />
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, isPhone && styles.inputPhone, isTinyPhone && styles.inputTinyPhone, { fontSize: inputFontSize }, webInputReset]}
                  placeholder="Enter your password"
                  placeholderTextColor={palette.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  importantForAutofill="yes"
                  multiline={false}
                  returnKeyType="done"
                  editable={!isSubmitting}
                  onFocus={() => scrollForInput('password')}
                  onSubmitEditing={handleLogin}
                  {...passwordAutofillProps}
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible((current) => !current)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isPasswordVisible ? (
                    <EyeOff color={palette.secondary} size={isPhone ? 20 : 22} strokeWidth={2} />
                  ) : (
                    <Eye color={palette.secondary} size={isPhone ? 20 : 22} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </Pressable>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={() => router.push('/forgot-password')}
                disabled={isSubmitting}
                activeOpacity={0.75}
              >
                <Typography variant="body" style={styles.forgotPasswordText}>
                  Forgot password?
                </Typography>
              </TouchableOpacity>

              {authError && (
                <Typography variant="caption" style={styles.errorText} align="center">
                  {authError}
                </Typography>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isCompact && styles.submitButtonCompact,
                  isTinyPhone && styles.submitButtonTinyPhone,
                  isSubmitting && styles.submitButtonDisabled,
                  { minHeight: submitHeight },
                ]}
                onPress={handleLogin}
                disabled={isSubmitting}
                activeOpacity={0.82}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color={palette.card} />
                ) : (
                  <Typography
                    variant="bodyLarge"
                    style={[styles.submitText, isPhone && styles.submitTextPhone, isTinyPhone && styles.submitTextTinyPhone, { fontSize: isTinyPhone ? 18 : isPhone ? 19 : 21 }]}
                  >
                    Sign In
                  </Typography>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.footer, isCompact && styles.footerCompact, isTinyPhone && styles.footerTinyPhone]}>
              <Typography
                variant="bodyLarge"
                style={[styles.footerText, isPhone && styles.footerTextPhone, isTinyPhone && styles.footerTextTinyPhone, { fontSize: isTinyPhone ? 14 : isPhone ? 15 : 17 }]}
              >
                {`Don't have an account? `}
              </Typography>
              <TouchableOpacity onPress={() => router.push('/signup')} disabled={isSubmitting} activeOpacity={0.75}>
                <Typography
                  variant="bodyLarge"
                  style={[styles.signUpText, isPhone && styles.footerTextPhone, isTinyPhone && styles.footerTextTinyPhone, { fontSize: isTinyPhone ? 14 : isPhone ? 15 : 17 }]}
                >
                  Sign up
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentCompact: {
    justifyContent: 'flex-start',
  },
  card: {
    borderRadius: 26,
    backgroundColor: palette.card,
    paddingTop: 40,
    paddingBottom: 34,
    alignItems: 'center',
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 7,
  },
  cardCompact: {
    paddingTop: 30,
    paddingBottom: 26,
    borderRadius: 24,
  },
  cardPhone: {
    paddingTop: 28,
    paddingBottom: 24,
    borderRadius: 24,
  },
  cardTinyPhone: {
    paddingTop: 24,
    paddingBottom: 22,
    borderRadius: 22,
  },
  header: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    marginBottom: 22,
  },
  logoCompact: {
    marginBottom: 18,
  },
  logoTinyPhone: {
    marginBottom: 14,
  },
  title: {
    color: palette.primary,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    color: palette.secondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    marginTop: 38,
    alignItems: 'center',
  },
  formCompact: {
    marginTop: 30,
  },
  formPhone: {
    marginTop: 28,
  },
  formTinyPhone: {
    marginTop: 22,
  },
  fieldLabel: {
    color: palette.secondary,
    lineHeight: 24,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 9,
  },
  fieldLabelPhone: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  passwordLabel: {
    marginTop: 22,
  },
  passwordLabelCompact: {
    marginTop: 20,
  },
  passwordLabelTinyPhone: {
    marginTop: 16,
  },
  inputBox: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: palette.outline,
    borderRadius: 14,
    backgroundColor: palette.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 21,
  },
  inputBoxPhone: {
    height: 62,
    paddingHorizontal: 14,
    borderRadius: 13,
  },
  inputBoxTinyPhone: {
    height: 58,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    color: palette.primary,
    lineHeight: 28,
    fontWeight: '400',
    paddingVertical: 0,
    paddingHorizontal: 14,
  },
  inputPhone: {
    height: 42,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  inputTinyPhone: {
    height: 40,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  eyeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 10,
    minHeight: 24,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    color: palette.primary,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'right',
  },
  errorText: {
    color: palette.error,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  submitButton: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 34,
    shadowColor: '#0f1743',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
  },
  submitButtonCompact: {
    marginTop: 30,
  },
  submitButtonTinyPhone: {
    marginTop: 26,
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitText: {
    color: palette.card,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  submitTextPhone: {
    fontSize: 22,
    lineHeight: 28,
  },
  submitTextTinyPhone: {
    fontSize: 20,
    lineHeight: 26,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 28,
  },
  footerCompact: {
    paddingTop: 24,
  },
  footerTinyPhone: {
    paddingTop: 18,
  },
  footerText: {
    color: palette.secondary,
    lineHeight: 28,
    textAlign: 'center',
  },
  footerTextPhone: {
    fontSize: 18,
    lineHeight: 25,
  },
  footerTextTinyPhone: {
    fontSize: 16,
    lineHeight: 23,
  },
  signUpText: {
    color: palette.primary,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
});
