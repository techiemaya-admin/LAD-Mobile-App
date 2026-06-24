import { Typography } from '@/components/ui/Typography';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const palette = {
  primary: '#0f1743',
  background: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#111827',
  secondary: '#4b5563',
  muted: '#6b7280',
  tabActive: '#0f1743',
  tabInactive: '#f1f5f9',
  tabInactiveText: '#4b5563',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Typography variant="h3" style={styles.sectionTitle}>{title}</Typography>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Typography style={styles.bulletDot}>{'•'}</Typography>
      <Typography variant="body" style={styles.bulletText}>{children}</Typography>
    </View>
  );
}

function Para({ children }: { children: string }) {
  return <Typography variant="body" style={styles.para}>{children}</Typography>;
}

export default function AccountDeletionPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={palette.primary} />
        </TouchableOpacity>
        <Typography variant="h3" style={styles.topBarTitle}>Legal</Typography>
        <View style={styles.backBtn} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, styles.tabInactive]}
            activeOpacity={0.85}
            onPress={() => router.replace('/(auth)/privacy-policy')}
          >
            <Typography style={styles.tabTextInactive}>Privacy Policy</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, styles.tabInactive]}
            activeOpacity={0.85}
            onPress={() => router.replace('/(auth)/terms-of-service')}
          >
            <Typography style={styles.tabTextInactive}>Terms of Service</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, styles.tabActive]} activeOpacity={0.85}>
            <Typography style={styles.tabTextActive}>Account Deletion</Typography>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Typography variant="h1" style={styles.headerTitle}>Account Deletion Policy</Typography>
          <Typography variant="bodySmall" style={styles.headerDate}>Last updated: June 2026</Typography>
        </View>

        {/* Intro */}
        <View style={styles.card}>
          <Para>
            At Mr LAD, we respect our clients' privacy and their right to control their data. This page explains how account deletion requests are handled and what happens to associated data.
          </Para>
        </View>

        {/* Sections */}
        <View style={styles.card}>
          <Section title="1. Requesting account deletion">
            <Para>
              Mr LAD accounts are created by our team for authorized tenants. To delete your account and associated data, contact us:
            </Para>
            <Bullet>Email: support@techiemaya.com</Bullet>
            <Bullet>Subject: Account Deletion Request</Bullet>
            <Typography variant="bodyLarge" style={[styles.subheading, { marginTop: 14 }]}>Please include the following so we can locate and verify your account:</Typography>
            <Bullet>Company name</Bullet>
            <Bullet>Registered user name</Bullet>
            <Bullet>Registered email address</Bullet>
            <Bullet>Registered phone number</Bullet>
            <Para>Our team may verify your identity before processing the request.</Para>
          </Section>

          <Section title="2. Data that will be deleted">
            <Para>Upon approval, we will permanently delete or anonymize:</Para>
            <Bullet>User profile information</Bullet>
            <Bullet>Login credentials and account access</Bullet>
            <Bullet>Conversation history</Bullet>
            <Bullet>Chat messages</Bullet>
            <Bullet>Lead journey records</Bullet>
            <Bullet>Campaign-related data</Bullet>
            <Bullet>Contact information stored within the account</Bullet>
            <Bullet>Account preferences and settings</Bullet>
          </Section>

          <Section title="3. Data that may be retained">
            <Para>Certain information may be retained when required for:</Para>
            <Bullet>Legal obligations</Bullet>
            <Bullet>Regulatory compliance</Bullet>
            <Bullet>Fraud prevention</Bullet>
            <Bullet>Security investigations</Bullet>
            <Bullet>Internal audit requirements</Bullet>
            <Para>Retained information will be securely stored with restricted access.</Para>
          </Section>

          <Section title="4. Deletion timeframe">
            <Para>Requests are processed within 30 days of verification and approval.</Para>
          </Section>

          <Section title="5. Important notes">
            <Bullet>Deletion is permanent and cannot be reversed.</Bullet>
            <Bullet>Account access cannot be restored after deletion.</Bullet>
            <Bullet>Removed data cannot be recovered.</Bullet>
            <Bullet>Active services or contractual obligations may need to be resolved before deletion proceeds.</Bullet>
          </Section>

          <Section title="6. Contact us">
            <Para>If you have questions about this policy or wish to request deletion, contact us at:</Para>
            <View style={styles.contactCard}>
              <Ionicons name="mail-outline" size={20} color={palette.primary} />
              <View style={styles.contactText}>
                <Typography variant="bodyLarge" style={styles.contactLabel}>Email</Typography>
                <TouchableOpacity onPress={() => Linking.openURL('mailto:support@techiemaya.com')} activeOpacity={0.7}>
                  <Typography variant="body" style={styles.contactLink}>support@techiemaya.com</Typography>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.contactCard, { marginTop: 10 }]}>
              <Ionicons name="location-outline" size={20} color={palette.primary} />
              <View style={styles.contactText}>
                <Typography variant="bodyLarge" style={styles.contactLabel}>TechieMaya FZE</Typography>
                <Typography variant="body" style={styles.contactAddr}>IDS Business Center, Al Karama, Dubai, United Arab Emirates</Typography>
              </View>
            </View>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: palette.primary,
    fontWeight: '700',
  },
  tabsContainer: {
    backgroundColor: palette.card,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: palette.tabActive,
  },
  tabInactive: {
    backgroundColor: palette.tabInactive,
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextInactive: {
    color: palette.tabInactiveText,
    fontWeight: '600',
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerTitle: {
    color: palette.primary,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerDate: {
    color: palette.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: palette.primary,
    fontWeight: '700',
    marginBottom: 10,
  },
  subheading: {
    color: palette.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  para: {
    color: palette.secondary,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    marginTop: 6,
    paddingRight: 4,
  },
  bulletDot: {
    color: palette.primary,
    marginRight: 8,
    marginTop: 1,
    fontSize: 16,
  },
  bulletText: {
    flex: 1,
    color: palette.secondary,
    lineHeight: 22,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginTop: 12,
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    color: palette.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactLink: {
    color: palette.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  contactAddr: {
    color: palette.secondary,
    lineHeight: 20,
  },
});
