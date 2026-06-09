import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { FileText, Mail, MessageCircle, Phone, RefreshCw } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { getSupportOverview, submitSupportRequest, SupportOverview } from '@/src/services/settingsHub';
import useAuthStore from '@/src/store/authStore';
import { useAppTheme } from '@/src/theme/appTheme';

export default function SupportScreen() {
  const appTheme = useAppTheme();
  const user = useAuthStore((state) => state.user);
  const [support, setSupport] = useState<SupportOverview | null>(null);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('LAD app support request');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadSupport = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const data = await getSupportOverview();
      setSupport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSupport();
  }, [loadSupport]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Missing details', 'Please enter your name, email, and message.');
      return;
    }

    setSubmitting(true);
    try {
      await submitSupportRequest({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || 'LAD app support request',
        message: message.trim(),
      });
      setMessage('');
      Alert.alert('Support request sent', 'Your message was sent to support.');
    } catch (err) {
      Alert.alert(
        'Support endpoint unavailable',
        err instanceof Error ? `${err.message}\n\nYou can still email support directly.` : 'You can still email support directly.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openMail = () => {
    const target = support?.email || 'support@techiemaya.com';
    const body = encodeURIComponent(message || 'Hi, I need help with LAD app.');
    const mailSubject = encodeURIComponent(subject || 'LAD app support request');
    Linking.openURL(`mailto:${target}?subject=${mailSubject}&body=${body}`).catch(() => undefined);
  };

  const options = [
    { icon: <MessageCircle color="#FFFFFF" size={24} />, title: 'Support Status', desc: support?.statusLabel || 'Checking backend support status' },
    { icon: <FileText color="#FFFFFF" size={24} />, title: 'Knowledge Base', desc: 'Read guides and workflow tutorials' },
    { icon: <Phone color="#FFFFFF" size={24} />, title: 'Request a Call', desc: support?.responseTime || 'For enterprise customers' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSupport(true)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Typography variant="h2" style={styles.headerTitle}>How can we help?</Typography>
            <Typography variant="bodyLarge" color={appTheme.muted}>
              Send a support request to the LAD backend or email the team directly.
            </Typography>
          </View>
          <TouchableOpacity style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => loadSupport(true)} disabled={refreshing || loading}>
            {refreshing || loading ? <ActivityIndicator color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={18} />}
          </TouchableOpacity>
        </View>

        {error ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="body" color={Theme.colors.error}>{error}</Typography>
          </GlassCard>
        ) : null}

        {options.map((opt) => (
          <GlassCard key={opt.title} style={styles.supportCard}>
            <View style={[styles.iconContainer, { backgroundColor: appTheme.primaryAccent }]}>
              {opt.icon}
            </View>
            <View style={styles.cardContent}>
              <Typography variant="h4">{opt.title}</Typography>
              <Typography variant="bodySmall" color={appTheme.muted} style={styles.optionDesc}>{opt.desc}</Typography>
            </View>
          </GlassCard>
        ))}

        <Typography variant="h4" style={styles.sectionTitle}>Send Support Request</Typography>
        <GlassCard style={styles.formCard}>
          <Typography variant="caption" color={appTheme.muted}>Name</Typography>
          <TextInput value={name} onChangeText={setName} style={[styles.input, { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border }]} placeholder="Your name" placeholderTextColor={appTheme.disabled} />

          <Typography variant="caption" color={appTheme.muted}>Email</Typography>
          <TextInput value={email} onChangeText={setEmail} style={[styles.input, { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border }]} placeholder="you@company.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={appTheme.disabled} />

          <Typography variant="caption" color={appTheme.muted}>Subject</Typography>
          <TextInput value={subject} onChangeText={setSubject} style={[styles.input, { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border }]} placeholder="Support subject" placeholderTextColor={appTheme.disabled} />

          <Typography variant="caption" color={appTheme.muted}>Message</Typography>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={[styles.input, styles.messageInput, { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border }]}
            placeholder="Describe what is happening..."
            placeholderTextColor={appTheme.disabled}
            multiline
            textAlignVertical="top"
          />

          <Button label="Submit Request" loading={submitting} onPress={handleSubmit} style={styles.submitButton} />
          <TouchableOpacity style={styles.emailButton} onPress={openMail}>
            <Mail color={appTheme.primaryAccent} size={18} />
            <Typography variant="bodySmall" color={appTheme.primaryAccent} style={styles.emailText}>Email {support?.email || 'support@techiemaya.com'}</Typography>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xxl,
    gap: Theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    marginBottom: Theme.spacing.sm,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  optionDesc: {
    marginTop: 4,
  },
  sectionTitle: {
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  formCard: {
    padding: Theme.spacing.lg,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.surface,
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.md,
  },
  messageInput: {
    minHeight: 110,
  },
  submitButton: {
    marginTop: Theme.spacing.sm,
  },
  emailButton: {
    marginTop: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  emailText: {
    fontWeight: '600',
  },
  messageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
});
