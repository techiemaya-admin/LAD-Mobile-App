import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleReset = () => {
    // Navigate to OTP verification for password reset
    router.push('/(auth)/otp-verification');
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
          <Logo variant="main" width={180} height={60} style={styles.logo} />
          <Typography variant="h1" style={styles.title}>Reset Password</Typography>
          <Typography variant="bodyLarge" color={Theme.colors.textSecondary}>
            Enter your email to receive a recovery code.
          </Typography>
        </View>

        <View style={styles.form}>
          <Input
            label="Email Address"
            placeholder="name@company.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail color={Theme.colors.textSecondary} size={20} />}
          />

          <Button
            label="Send Recovery Code"
            onPress={handleReset}
            style={styles.submitButton}
          />
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
  logo: {
    marginBottom: Theme.spacing.lg,
    marginLeft: -Theme.spacing.xs,
  },
  title: {
    marginBottom: Theme.spacing.xs,
  },
  form: {
    marginBottom: Theme.spacing.xxl,
  },
  submitButton: {
    marginTop: Theme.spacing.md,
  },
});
