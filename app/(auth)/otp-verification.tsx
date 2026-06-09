import React, { useState, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';

export default function OTPVerificationScreen() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    // Verify OTP and navigate to tabs
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft color={Theme.colors.text} size={24} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Typography variant="h1" style={styles.title}>Verify Code</Typography>
          <Typography variant="bodyLarge" color={Theme.colors.textSecondary}>
            Enter the 6-digit code we sent to your email.
          </Typography>
        </View>

        <View style={styles.form}>
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                ]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
              />
            ))}
          </View>

          <Button
            label="Verify & Proceed"
            onPress={handleVerify}
            style={styles.submitButton}
            disabled={otp.some(digit => digit === '')}
          />
        </View>

        <View style={styles.footer}>
          <Typography variant="body" color={Theme.colors.textSecondary}>
            Didn&apos;t receive the code?{' '}
          </Typography>
          <TouchableOpacity>
            <Typography variant="body" color={Theme.colors.primary} style={{ fontWeight: '600' }}>
              Resend
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.spacing.xl,
    paddingTop: Theme.spacing.xxxl,
  },
  backButton: {
    marginBottom: Theme.spacing.xl,
    marginTop: Theme.spacing.md,
  },
  header: {
    marginBottom: Theme.spacing.xxxl,
  },
  title: {
    marginBottom: Theme.spacing.xs,
  },
  form: {
    marginBottom: Theme.spacing.xxl,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xxl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surface,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  otpInputFilled: {
    borderColor: Theme.colors.primary,
  },
  submitButton: {
    marginTop: Theme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: Theme.spacing.xl,
  },
});
