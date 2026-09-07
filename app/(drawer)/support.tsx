import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Mail, MessageCircle, Phone, RefreshCw } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { IOSCollapsibleScrollView } from '@/components/ui/IOSCollapsibleScrollView';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { getSupportOverview, submitSupportRequest, SupportOverview } from '@/src/services/settingsHub';
import useAuthStore from '@/src/store/authStore';
import { useAppTheme } from '@/src/theme/appTheme';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

const SUPPORT_CACHE_KEY = 'drawer.support';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const user = useAuthStore((state) => state.user);

  const [support, setSupport] = useState<SupportOverview | null>(
    () => readScreenCache<SupportOverview>(SUPPORT_CACHE_KEY)?.value ?? null,
  );
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('LAD app support request');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(() => !readScreenCache<SupportOverview>(SUPPORT_CACHE_KEY));
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
      writeScreenCache(SUPPORT_CACHE_KEY, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      loadSupport();
    }
  }, [loadSupport, loading]);

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
        err instanceof Error
          ? `${err.message}\n\nYou can still email support directly.`
          : 'You can still email support directly.',
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
    {
      icon: <MessageCircle color="#FFFFFF" size={22} />,
      title: 'Support Status',
      desc: support?.statusLabel || 'Checking backend support status',
    },
    {
      icon: <FileText color="#FFFFFF" size={22} />,
      title: 'Knowledge Base',
      desc: 'Read guides and workflow tutorials',
    },
    {
      icon: <Phone color="#FFFFFF" size={22} />,
      title: 'Request a Call',
      desc: support?.responseTime || 'For enterprise customers',
    },
  ];

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <IOSCollapsibleScrollView
        title="Help & Support"
        subtitle="Send a support request or email the team directly."
        rightElement={
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
            onPress={() => loadSupport(true)}
            disabled={refreshing || loading}
            activeOpacity={0.8}
          >
            {refreshing || loading ? (
              <ActivityIndicator color={appTheme.primaryAccent} size="small" />
            ) : (
              <RefreshCw color={appTheme.primaryAccent} size={17} />
            )}
          </TouchableOpacity>
        }
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSupport(true)}
            tintColor={appTheme.primaryAccent}
            colors={[appTheme.primaryAccent]}
          />
        }
      >
        {error ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="body" color={Theme.colors.error}>
              {error}
            </Typography>
          </GlassCard>
        ) : null}

        {options.map((opt) => (
          <GlassCard key={opt.title} style={styles.supportCard}>
            <View style={[styles.iconContainer, { backgroundColor: appTheme.primaryAccent }]}>
              {opt.icon}
            </View>
            <View style={styles.cardContent}>
              <Typography variant="h4">{opt.title}</Typography>
              <Typography variant="bodySmall" color={appTheme.muted} style={styles.optionDesc}>
                {opt.desc}
              </Typography>
            </View>
          </GlassCard>
        ))}

        <Typography variant="h4" style={styles.sectionTitle}>
          Send Support Request
        </Typography>
        <GlassCard style={styles.formCard}>
          <Typography variant="caption" color={appTheme.muted}>
            Name
          </Typography>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[
              styles.input,
              { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border },
            ]}
            placeholder="Your name"
            placeholderTextColor={appTheme.disabled}
          />

          <Typography variant="caption" color={appTheme.muted}>
            Email
          </Typography>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={[
              styles.input,
              { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border },
            ]}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={appTheme.disabled}
          />

          <Typography variant="caption" color={appTheme.muted}>
            Subject
          </Typography>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            style={[
              styles.input,
              { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border },
            ]}
            placeholder="Support subject"
            placeholderTextColor={appTheme.disabled}
          />

          <Typography variant="caption" color={appTheme.muted}>
            Message
          </Typography>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={[
              styles.input,
              styles.messageInput,
              { color: appTheme.text, backgroundColor: appTheme.input, borderColor: appTheme.border },
            ]}
            placeholder="Describe what is happening..."
            placeholderTextColor={appTheme.disabled}
            multiline
            textAlignVertical="top"
          />

          <Button label="Submit Request" loading={submitting} onPress={handleSubmit} style={styles.submitButton} />
          <TouchableOpacity style={styles.emailButton} onPress={openMail}>
            <Mail color={appTheme.primaryAccent} size={18} />
            <Typography variant="bodySmall" color={appTheme.primaryAccent} style={styles.emailText}>
              Email {support?.email || 'support@techiemaya.com'}
            </Typography>
          </TouchableOpacity>
        </GlassCard>
      </IOSCollapsibleScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
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
