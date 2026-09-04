import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, Building } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = () => {
    // Navigate to OTP verification
    router.push('/otp-verification');
  };

  const Container = Platform.OS === 'web' ? View : KeyboardAvoidingView;

  return (
    <Container
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Logo variant="main" width={180} height={60} style={styles.logo} />
          <Typography variant="h1" style={styles.title}>Create Account</Typography>
          <Typography variant="bodyLarge" color={Theme.colors.textSecondary}>
            Start managing your leads effectively.
          </Typography>
        </View>

        <View style={styles.form} pointerEvents="box-none">
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
            leftIcon={User ? <User color={Theme.colors.textSecondary} size={20} /> : null}
          />

          <Input
            label="Company Name"
            placeholder="Acme Corp"
            value={company}
            onChangeText={setCompany}
            leftIcon={Building ? <Building color={Theme.colors.textSecondary} size={20} /> : null}
          />

          <Input
            label="Work Email"
            placeholder="john@company.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={Mail ? <Mail color={Theme.colors.textSecondary} size={20} /> : null}
          />

          <Input
            label="Password"
            placeholder="Create a strong password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={Lock ? <Lock color={Theme.colors.textSecondary} size={20} /> : null}
          />

          <Button
            label="Create Account"
            onPress={handleSignup}
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Typography variant="body" color={Theme.colors.textSecondary}>
            Already have an account?{' '}
          </Typography>
          <TouchableOpacity onPress={() => router.back()}>
            <Typography variant="body" color={Theme.colors.primary} style={{ fontWeight: '600' }}>
              Sign in
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Container>
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
    paddingTop: Theme.spacing.xxxl * 2,
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
    marginTop: Theme.spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: Theme.spacing.xl,
  },
});
