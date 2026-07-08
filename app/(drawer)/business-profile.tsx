import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Save,
  Target,
  Upload,
  Users,
  X,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { BusinessHoursModal, BusinessHoursPayload } from '@/components/features/BusinessHoursModal';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAppTheme } from '@/src/theme/appTheme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';
import {
  getBusinessProfile,
  saveBusinessProfile,
  uploadCompanyLogo,
  BusinessProfileData,
  emptyBusinessProfile,
} from '@/src/services/businessProfile';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

const PROFILE_CACHE_KEY = 'drawer.business-profile';

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '501–1000', '1000+'];

const WEB_INPUT_RESET = Platform.OS === 'web' ? { outlineStyle: 'none' as any } : undefined;
const ICP_SECTION = {
  title: 'Ideal Customer Profile (ICP)',
  subtitle: "Who you sell to. The ICP chat writes these.",
  keys: ['icpJobTitles', 'icpCompanySize', 'icpLocations', 'icpPainPoints', 'companyDescription'] as const,
};

const CAMPAIGN_SECTION = {
  title: 'AI & Campaign Settings',
  subtitle: 'Help the AI personalise your outreach and campaigns.',
  keys: ['valueProposition', 'productsServices', 'targetCustomers', 'sampleConversation', 'operatingHours', 'timezone', 'geographicFocus', 'competitors', 'campaignTone'] as const,
};

const FIELD_META: Record<string, { label: string; multiline?: boolean; placeholder?: string }> = {
  valueProposition: { label: 'Value proposition', multiline: true, placeholder: 'AI sales assistant for outbound teams.' },
  productsServices: { label: 'Products & services', multiline: true },
  targetCustomers: { label: 'Target customers', multiline: true },
  icpJobTitles: { label: 'Job titles', placeholder: 'Head of Growth, VP Sales' },
  icpCompanySize: { label: 'ICP company size', placeholder: '50–250 employees' },
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

  const [profile, setProfile] = useState<BusinessProfileData>(
    () => readScreenCache<BusinessProfileData>(PROFILE_CACHE_KEY)?.value ?? emptyBusinessProfile(),
  );
  const [loading, setLoading] = useState(() => !readScreenCache<BusinessProfileData>(PROFILE_CACHE_KEY));
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [hoursModal, setHoursModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBusinessProfile();
      setProfile(data);
      writeScreenCache(PROFILE_CACHE_KEY, data);
    } catch {
      setError('Failed to load business profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always refresh from API; cached value shown instantly above
    void loadData();
  }, [loadData]);

  const set = useCallback((key: keyof BusinessProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      await saveBusinessProfile(profile);
      writeScreenCache(PROFILE_CACHE_KEY, profile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setLogoError(null);
      setLogoUploading(true);
      try {
        const url = await uploadCompanyLogo(
          asset.uri,
          asset.mimeType || 'image/jpeg',
          asset.name || 'company-logo.jpg',
        );
        setProfile((prev) => ({ ...prev, logoUrl: url }));
      } catch (err) {
        setProfile((prev) => ({ ...prev, logoUrl: asset.uri }));
        setLogoError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setLogoUploading(false);
      }
    } catch {
      Alert.alert('Error', 'Could not open image picker.');
    }
  };

  const saveHours = (payload: BusinessHoursPayload, summary: string) => {
    setProfile((prev) => ({ ...prev, operatingHours: summary, businessHoursPayload: payload }));
    setHoursModal(false);
  };

  const bg = appTheme.background;
  const surface = appTheme.surface;
  const border = appTheme.border;
  const borderSoft = appTheme.borderSoft;
  const text = appTheme.text;
  const muted = appTheme.muted;
  const primary = appTheme.primaryAccent;
  const inputBg = appTheme.input;

  if (loading) {
    return (
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AnimatedScreen style={styles.flex}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.pageHeader, { alignItems: 'center' }]}>
              <Typography variant="h1" color={text} style={[styles.pageTitle, { textAlign: 'center' }]}>Business Profile</Typography>
              <Typography variant="body" color={muted} style={{ textAlign: 'center' }}>
                Define your company to improve AI personalisation.
              </Typography>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          </ScrollView>
        </AnimatedScreen>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AnimatedScreen style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.pageHeader}>
            <Typography variant="h1" color={text} style={styles.pageTitle}>Business Profile</Typography>
            <Typography variant="body" color={muted}>
              Define your company to improve AI personalisation.
            </Typography>
          </View>

          {/* Banners */}
          {!!error && (
            <View style={[styles.banner, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
              <AlertTriangle color={Theme.colors.error} size={16} />
              <Typography variant="bodySmall" color={Theme.colors.error} style={styles.bold}>{error}</Typography>
              <TouchableOpacity onPress={() => setError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Theme.colors.error} size={14} />
              </TouchableOpacity>
            </View>
          )}
          {!!saveSuccess && (
            <View style={[styles.banner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <CheckCircle2 color={Theme.colors.success} size={16} />
              <Typography variant="bodySmall" color={Theme.colors.success} style={styles.bold}>
                Profile saved!
              </Typography>
            </View>
          )}

          {/* ── CARD 1: COMPANY BASICS (logo, location, hours) ── */}
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.cardHead}>
              <Building2 color={primary} size={18} />
              <View style={styles.cardHeadText}>
                <Typography variant="h4" color={text} style={styles.bold}>Company basics</Typography>
                <Typography variant="caption" color={muted}>Logo, location, and operating hours.</Typography>
              </View>
            </View>

            {/* Logo */}
            <View style={[styles.logoRow, { borderTopColor: borderSoft }]}>
              <TouchableOpacity
                onPress={pickLogo}
                disabled={logoUploading}
                activeOpacity={0.8}
                style={[styles.logoCircle, { backgroundColor: borderSoft, borderColor: border }]}
              >
                {profile.logoUrl ? (
                  <Image source={{ uri: profile.logoUrl }} style={styles.logoImg} resizeMode="cover" />
                ) : (
                  <Building2 color={muted} size={28} />
                )}
                {logoUploading && (
                  <View style={styles.logoOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <Typography variant="caption" color={text} style={[styles.bold, { marginTop: 8 }]}>
                Company logo
              </Typography>
              {!!logoError && (
                <Typography variant="caption" color={Theme.colors.error} style={styles.logoErr}>
                  {logoError}
                </Typography>
              )}
              <TouchableOpacity
                onPress={pickLogo}
                disabled={logoUploading}
                activeOpacity={0.75}
                style={[styles.uploadBtn, { borderColor: border }]}
              >
                <Upload color={text} size={13} />
                <Typography variant="caption" color={text} style={styles.bold}>Upload</Typography>
              </TouchableOpacity>
            </View>

            {/* Company location */}
            <View style={[styles.infoRow, { borderTopColor: borderSoft }]}>
              <View style={styles.rowHead}>
                <MapPin color={primary} size={15} />
                <Typography variant="bodySmall" color={text} style={styles.bold}>Company location</Typography>
              </View>
              <Typography variant="caption" color={muted} style={styles.rowSub}>
                Where your business is based.
              </Typography>
              <View style={[styles.inputBox, { backgroundColor: inputBg, borderColor: border }]}>
                <TextInput
                  value={[profile.city, profile.country].filter(Boolean).join(', ')}
                  onChangeText={(v) => {
                    const parts = v.split(',').map((p) => p.trim());
                    set('city', parts[0] ?? '');
                    set('country', parts[1] ?? '');
                  }}
                  placeholder="Dubai, UAE"
                  placeholderTextColor={muted}
                  style={[styles.textInput, { color: text }]}
                />
              </View>
            </View>

            {/* Business hours */}
            <View style={[styles.infoRow, styles.hoursRow, { borderTopColor: borderSoft }]}>
              <View style={styles.hoursLeft}>
                <View style={styles.rowHead}>
                  <Clock color={primary} size={15} />
                  <Typography variant="bodySmall" color={text} style={styles.bold}>Business hours</Typography>
                </View>
                <TouchableOpacity onPress={() => setHoursModal(true)} style={[styles.timeBadge, { backgroundColor: appTheme.softSurface }]}>
                  <Typography variant="caption" color={primary} style={styles.bold}>
                    {profile.operatingHours || 'Set Business Hours'}
                  </Typography>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setHoursModal(true)}
                activeOpacity={0.75}
                style={[styles.setHoursBtn, { borderColor: border }]}
              >
                <Typography variant="caption" color={text} style={styles.bold}>Edit</Typography>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── CARD 2: COMPANY (name, details, size) ── */}
          <View style={styles.gap} />
          <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
            <View style={styles.cardHead}>
              <Building2 color={primary} size={18} />
              <View style={styles.cardHeadText}>
                <Typography variant="h4" color={text} style={styles.bold}>Company</Typography>
                <Typography variant="caption" color={muted}>Details about your company and team.</Typography>
              </View>
            </View>

            <InfoRow icon={<Building2 color={primary} size={15} />} label="Company name"
              value={profile.companyName} placeholder="Acme Inc."
              onChange={(v) => set('companyName', v)}
              inputBg={inputBg} border={border} borderSoft={borderSoft} text={text} muted={muted} />

            <InfoRow icon={<Target color={primary} size={15} />} label="Tagline"
              value={profile.tagline} placeholder="One-line description of what you do"
              onChange={(v) => set('tagline', v)}
              inputBg={inputBg} border={border} borderSoft={borderSoft} text={text} muted={muted} />

            <InfoRow icon={<Target color={primary} size={15} />} label="Industry"
              value={profile.industry} placeholder="B2B SaaS, Healthtech…"
              onChange={(v) => set('industry', v)}
              inputBg={inputBg} border={border} borderSoft={borderSoft} text={text} muted={muted} />

            <InfoRow icon={<Globe color={primary} size={15} />} label="Website"
              value={profile.website} placeholder="https://acme.com"
              keyboardType="url" autoCapitalize="none"
              onChange={(v) => set('website', v)}
              inputBg={inputBg} border={border} borderSoft={borderSoft} text={text} muted={muted} />

            <InfoRow icon={<Phone color={primary} size={15} />} label="Business phone"
              value={profile.phone} placeholder="+971 50 000 0000"
              keyboardType="phone-pad"
              onChange={(v) => set('phone', v)}
              inputBg={inputBg} border={border} borderSoft={borderSoft} text={text} muted={muted} />

            <InfoRow icon={<Mail color={primary} size={15} />} label="Business email"
              value={profile.email} placeholder="hello@acme.com"
              keyboardType="email-address" autoCapitalize="none"
              onChange={(v) => set('email', v)}
              inputBg={inputBg} border={border} borderSoft={borderSoft} text={text} muted={muted} />

            {/* Company size */}
            <View style={[styles.infoRow, { borderTopColor: borderSoft }]}>
              <View style={styles.rowHead}>
                <Users color={primary} size={15} />
                <Typography variant="bodySmall" color={text} style={styles.bold}>Company size</Typography>
              </View>
              <View style={styles.sizeRow}>
                {COMPANY_SIZES.map((size) => {
                  const active = profile.companySize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      activeOpacity={0.75}
                      onPress={() => set('companySize', active ? '' : size)}
                      style={[
                        styles.sizeChip,
                        { borderColor: active ? primary : border },
                        active ? { backgroundColor: primary } : null,
                      ]}
                    >
                      <Typography
                        variant="caption"
                        color={active ? '#fff' : text}
                        style={styles.sizeChipLabel}
                      >
                        {size}
                      </Typography>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── ICP CARD ── */}
          <View style={styles.gap} />
          <GlassCard style={styles.glassPad}>
            <View style={styles.sectionHead}>
              <Target color={primary} size={18} />
              <View style={styles.cardHeadText}>
                <Typography variant="h4" color={text} style={styles.bold}>{ICP_SECTION.title}</Typography>
                <Typography variant="caption" color={muted}>{ICP_SECTION.subtitle}</Typography>
              </View>
            </View>
            {ICP_SECTION.keys.map((key) => {
              const f = FIELD_META[key];
              if (!f) return null;
              return (
                <Input key={key} label={f.label} placeholder={f.placeholder ?? ''}
                  value={profile[key] || ''} onChangeText={(v) => set(key, v)}
                  multiline={f.multiline} numberOfLines={f.multiline ? 3 : 1}
                  style={f.multiline ? styles.multiline : undefined}
                  textAlignVertical={f.multiline ? 'top' : 'center'} />
              );
            })}
          </GlassCard>

          {/* ── CAMPAIGN CARD ── */}
          <View style={styles.gap} />
          <GlassCard style={styles.glassPad}>
            <View style={styles.sectionHead}>
              <Users color={primary} size={18} />
              <View style={styles.cardHeadText}>
                <Typography variant="h4" color={text} style={styles.bold}>{CAMPAIGN_SECTION.title}</Typography>
                <Typography variant="caption" color={muted}>{CAMPAIGN_SECTION.subtitle}</Typography>
              </View>
            </View>
            {CAMPAIGN_SECTION.keys.map((key) => {
              const f = FIELD_META[key];
              if (!f) return null;
              return (
                <Input key={key} label={f.label} placeholder={f.placeholder ?? ''}
                  value={profile[key] || ''} onChangeText={(v) => set(key, v)}
                  multiline={f.multiline} numberOfLines={f.multiline ? 3 : 1}
                  style={f.multiline ? styles.multiline : undefined}
                  textAlignVertical={f.multiline ? 'top' : 'center'} />
              );
            })}
          </GlassCard>

          {/* Save */}
          <View style={styles.saveWrap}>
            <Button label="Save Profile" onPress={handleSave} loading={saving}
              leftIcon={<Save color="#fff" size={18} />} />
          </View>
        </ScrollView>
      </AnimatedScreen>

      <BusinessHoursModal
        visible={hoursModal}
        initialData={profile.businessHoursPayload ?? undefined}
        onSave={saveHours}
        onClose={() => setHoursModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ── InfoRow ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, placeholder, keyboardType, autoCapitalize, onChange,
  inputBg, border, borderSoft, text, muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  onChange: (v: string) => void;
  inputBg: string;
  border: string;
  borderSoft: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={[styles.infoRow, { borderTopColor: borderSoft }]}>
      <View style={styles.rowHead}>
        {icon}
        <Typography variant="bodySmall" color={text} style={styles.bold}>{label}</Typography>
      </View>
      <View style={[styles.inputBox, { backgroundColor: inputBg, borderColor: border }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder ?? ''}
          placeholderTextColor={muted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'words'}
          style={[styles.textInput, WEB_INPUT_RESET, { color: text }]}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 36, lineHeight: 42, fontWeight: '800' },
  bold: { fontWeight: '600' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },

  // Company basics card
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16 },
  cardHeadText: { flex: 1, gap: 2 },

  // Logo
  logoRow: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, borderTopWidth: 1, gap: 6 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 80, height: 80, borderRadius: 40 },
  logoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  logoErr: { textAlign: 'center', fontSize: 11 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },

  // Info rows
  infoRow: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, gap: 8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowSub: { paddingLeft: 22 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 46 },
  textInput: { flex: 1, fontSize: 14, minHeight: 44 },

  // Hours row
  hoursRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hoursLeft: { flex: 1, gap: 4 },
  setHoursBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },

  // Size
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  sizeChipLabel: { fontWeight: '600', fontSize: 12 },

  // Other sections
  gap: { height: 20 },
  glassPad: { padding: Theme.spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Theme.spacing.md },
  multiline: { minHeight: 80, paddingTop: 10 },
  saveWrap: { marginTop: 24, marginBottom: 24 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalBody: { padding: 20, gap: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
