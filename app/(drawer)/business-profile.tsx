import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Target, Save, CheckCircle2, AlertTriangle, Building2, MapPin, Clock } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAppTheme } from '@/src/theme/appTheme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import { getBusinessProfile, saveBusinessProfile, BusinessProfileData, emptyBusinessProfile } from '@/src/services/businessProfile';

const SECTIONS = [
  {
    title: 'Company Basics',
    subtitle: 'Who you are. The wizard\'s Company step writes these.',
    keys: ['companyName', 'website', 'industry', 'valueProposition', 'productsServices', 'targetCustomers'],
  },
  {
    title: 'Ideal Customer Profile (ICP)',
    subtitle: 'Who you sell to. The ICP chat writes these.',
    keys: ['icpJobTitles', 'icpCompanySize', 'icpLocations', 'icpPainPoints', 'companyDescription'],
  },
  {
    title: 'Optional',
    subtitle: 'Not required for the core flow, but help the AI personalise.',
    keys: ['sampleConversation', 'operatingHours', 'timezone', 'geographicFocus', 'competitors', 'campaignTone'],
  },
];

const FIELD_LABELS: Record<string, { label: string; multiline?: boolean; placeholder?: string }> = {
  companyName: { label: 'Company name', placeholder: 'Acme Inc.' },
  website: { label: 'Website', placeholder: 'https://acme.com' },
  industry: { label: 'Industry', placeholder: 'B2B SaaS, Healthtech' },
  valueProposition: { label: 'Value proposition', multiline: true, placeholder: 'AI sales assistant for outbound teams.' },
  productsServices: { label: 'Products & services', multiline: true },
  targetCustomers: { label: 'Target customers', multiline: true },
  
  icpJobTitles: { label: 'Job titles', placeholder: 'Head of Growth, VP Sales' },
  icpCompanySize: { label: 'Company size', placeholder: '50–250 employees' },
  icpLocations: { label: 'Locations', placeholder: 'UAE, Saudi Arabia' },
  icpPainPoints: { label: 'Pain points', multiline: true },
  companyDescription: { label: 'Company description', multiline: true },
  
  sampleConversation: { label: 'Sample conversation', multiline: true },
  operatingHours: { label: 'Operating hours', placeholder: '09:00 – 18:00' },
  timezone: { label: 'Timezone', placeholder: 'GST+4' },
  geographicFocus: { label: 'Geographic focus', placeholder: 'GCC, MENA' },
  competitors: { label: 'Competitors' },
  campaignTone: { label: 'Campaign tone', placeholder: 'Friendly, direct, low-jargon' },
};

export default function BusinessProfileScreen() {
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const [profile, setProfile] = useState<BusinessProfileData>(emptyBusinessProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinessProfile();
      setProfile(data);
    } catch (err) {
      setError('Failed to load business profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      await saveBusinessProfile(profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save business profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof BusinessProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  // Compute completeness
  const totalFields = Object.keys(FIELD_LABELS).length;
  const filledFields = Object.keys(FIELD_LABELS).filter(k => !!profile[k as keyof BusinessProfileData]).length;
  const progressPercent = Math.round((filledFields / totalFields) * 100);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: appTheme.background }]}>
        <ActivityIndicator size="large" color={appTheme.primaryAccent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: appTheme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AnimatedScreen style={styles.container}>
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Typography variant="h2" color={appTheme.text}>Business Profile</Typography>
              <Typography variant="body" color={appTheme.muted}>
                Define your company and ideal customer to improve AI personalization.
              </Typography>
            </View>
          </View>

          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Typography variant="h4" color={appTheme.text}>Profile Completeness</Typography>
              <Typography variant="h4" color={appTheme.primaryAccent}>{progressPercent}%</Typography>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: appTheme.borderSoft }]}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: appTheme.primaryAccent }]} />
            </View>
            <Typography variant="caption" color={appTheme.muted} style={styles.progressText}>
              {filledFields} of {totalFields} fields completed
            </Typography>
          </GlassCard>

          {error && (
            <GlassCard style={[styles.messageCard, { borderColor: Theme.colors.error }]}>
              <AlertTriangle color={Theme.colors.error} size={20} />
              <Typography variant="bodySmall" color={Theme.colors.error} style={{ marginLeft: 8 }}>
                {error}
              </Typography>
            </GlassCard>
          )}

          {saveSuccess && (
            <GlassCard style={[styles.messageCard, { borderColor: Theme.colors.success }]}>
              <CheckCircle2 color={Theme.colors.success} size={20} />
              <Typography variant="bodySmall" color={Theme.colors.success} style={{ marginLeft: 8 }}>
                Profile saved successfully!
              </Typography>
            </GlassCard>
          )}

          {SECTIONS.map((section, idx) => (
            <View key={idx} style={styles.section}>
              <Typography variant="h3" color={appTheme.text} style={styles.sectionTitle}>
                {section.title}
              </Typography>
              <Typography variant="caption" color={appTheme.muted} style={styles.sectionSubtitle}>
                {section.subtitle}
              </Typography>
              <GlassCard style={styles.formCard}>
                {section.keys.map(key => {
                  const field = FIELD_LABELS[key];
                  if (!field) return null;
                  return (
                    <Input
                      key={key}
                      label={field.label}
                      placeholder={field.placeholder || ''}
                      value={profile[key as keyof BusinessProfileData] || ''}
                      onChangeText={(val) => handleChange(key as keyof BusinessProfileData, val)}
                      multiline={field.multiline}
                      numberOfLines={field.multiline ? 3 : 1}
                      style={field.multiline ? styles.multilineInput : undefined}
                      textAlignVertical={field.multiline ? 'top' : 'center'}
                    />
                  );
                })}
              </GlassCard>
            </View>
          ))}

          <View style={styles.actionContainer}>
            <Button
              label="Save Profile"
              onPress={handleSave}
              loading={saving}
              leftIcon={<Save color="#fff" size={20} />}
            />
          </View>
        </ScrollView>
      </AnimatedScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.lg,
  },
  header: {
    marginBottom: Theme.spacing.xl,
  },
  headerText: {
    flex: 1,
  },
  progressCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.sm,
  },
  progressBarBg: {
    height: 8,
    borderRadius: Theme.radius.full,
    overflow: 'hidden',
    marginBottom: Theme.spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Theme.radius.full,
  },
  progressText: {
    marginTop: Theme.spacing.xs,
  },
  section: {
    marginBottom: Theme.spacing.xl,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  sectionSubtitle: {
    marginBottom: Theme.spacing.md,
  },
  formCard: {
    padding: Theme.spacing.lg,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  actionContainer: {
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
    borderWidth: 1,
  },
});
