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

export default function PrivacyPolicyScreen() {
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
          <TouchableOpacity style={[styles.tab, styles.tabActive]} activeOpacity={0.85}>
            <Typography style={styles.tabTextActive}>Privacy Policy</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, styles.tabInactive]}
            activeOpacity={0.85}
            onPress={() => router.replace('/(auth)/terms-of-service')}
          >
            <Typography style={styles.tabTextInactive}>Terms of Service</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, styles.tabInactive]}
            activeOpacity={0.85}
            onPress={() => router.replace('/(auth)/account-deletion-policy')}
          >
            <Typography style={styles.tabTextInactive}>Account Deletion</Typography>
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
          <Typography variant="h1" style={styles.headerTitle}>Privacy Policy</Typography>
          <Typography variant="bodySmall" style={styles.headerDate}>Last updated: May 29, 2026</Typography>
        </View>

        {/* Intro */}
        <View style={styles.card}>
          <Para>
            This Privacy Policy explains how Mr LAD collects, uses, discloses, and safeguards your information when you visit mrlads.com or use our services. We are committed to protecting your privacy and handling your data transparently and responsibly.
          </Para>
        </View>

        {/* Sections */}
        <View style={styles.card}>
          <Section title="1. Who we are">
            <Para>
              Mr LAD ("Mr LAD", "we", "us", or "our") is an AI-powered sales and marketing platform operated by TechieMaya FZE, based at IDS Business Center, Al Karama, Dubai, United Arab Emirates. This Privacy Policy applies to our website at mrlads.com, our applications, and the related services (collectively, the "Services").
            </Para>
          </Section>

          <Section title="2. Our roles: controller and processor">
            <Para>Depending on the data involved, we act in one of two roles:</Para>
            <Bullet>As a data controller — for the personal data of our account holders, their authorized users, and website visitors (for example, your name, email, billing details, and how you use the Services). This policy describes that processing.</Bullet>
            <Bullet>As a data processor — for the personal data that our customers upload to, generate within, or process through the Services about their own leads, prospects, and contacts ("Customer Data"). For Customer Data, the Customer is the controller. If you are a lead or contact of one of our Customers and wish to exercise your rights, please contact that Customer directly.</Bullet>
          </Section>

          <Section title="3. Information we collect">
            <Typography variant="bodyLarge" style={styles.subheading}>3.1 Information you provide to us</Typography>
            <Bullet>Account &amp; profile data — name, business name, email address, phone number, password, role, and time zone.</Bullet>
            <Bullet>Billing &amp; transaction data — billing contact, plan, wallet/credit balances, and payment records. Card details are handled by our payment processor.</Bullet>
            <Bullet>Communications — messages you send us via contact forms, email, or support.</Bullet>
            <Bullet>Content &amp; configuration — campaigns, message templates, prompts, agent settings, and other content you create.</Bullet>

            <Typography variant="bodyLarge" style={[styles.subheading, { marginTop: 14 }]}>3.2 Information collected automatically</Typography>
            <Bullet>Usage data — pages viewed, features used, actions taken, and timestamps.</Bullet>
            <Bullet>Device &amp; technical data — IP address, browser type, operating system, device identifiers, and referring URLs.</Bullet>
            <Bullet>Cookies &amp; similar technologies — see our Cookies Policy for details on what we use and how to manage your preferences.</Bullet>

            <Typography variant="bodyLarge" style={[styles.subheading, { marginTop: 14 }]}>3.3 Information from third parties</Typography>
            <Bullet>Connected accounts &amp; integrations — when you connect channels such as LinkedIn, WhatsApp, Instagram, email, or telephony, we receive data from those providers as needed to operate the integration.</Bullet>
            <Bullet>Data enrichment providers — we may obtain or verify business contact information from third-party enrichment and data sources.</Bullet>
          </Section>

          <Section title="4. How we use information">
            <Para>We use personal data to:</Para>
            <Bullet>Provide, operate, maintain, and improve the Services;</Bullet>
            <Bullet>Create and manage accounts and authenticate users;</Bullet>
            <Bullet>Process payments, manage wallets/credits, and prevent fraud;</Bullet>
            <Bullet>Run, automate, and optimize campaigns and conversations on behalf of Customers;</Bullet>
            <Bullet>Generate AI-assisted content, replies, and recommendations;</Bullet>
            <Bullet>Provide customer support and respond to inquiries;</Bullet>
            <Bullet>Send service, security, and transactional communications;</Bullet>
            <Bullet>Monitor usage, analyze trends, and ensure security and reliability;</Bullet>
            <Bullet>Comply with legal obligations and enforce our terms.</Bullet>
          </Section>

          <Section title="5. AI and automated processing">
            <Para>
              The Services use artificial intelligence and large language models to generate messages, summaries, suggestions, and other outputs. To provide these features, relevant content may be sent to AI model providers acting as our sub-processors. We do not authorize these providers to use your data to train their general-purpose models. AI-generated output may be inaccurate or incomplete; you are responsible for reviewing it before relying on or sending it.
            </Para>
          </Section>

          <Section title="6. Legal bases for processing">
            <Para>
              Where the EU/UK GDPR or similar laws apply, we rely on: performance of a contract (to provide the Services), legitimate interests (to operate, secure, and improve the Services), consent (for example, certain cookies and marketing), and legal obligation (to comply with applicable law).
            </Para>
          </Section>

          <Section title="7. How we share information">
            <Para>We do not sell your personal data. We share information only as described below:</Para>
            <Bullet>Service providers / sub-processors — vendors who process data on our behalf, including Google Cloud Platform (hosting), Anthropic and Google (AI models), Stripe (payments), Meta Platforms (WhatsApp, Instagram, advertising), and telephony/voice providers.</Bullet>
            <Bullet>At your direction — with third-party platforms and recipients when you use integrations or send communications through the Services.</Bullet>
            <Bullet>Legal &amp; safety — when required by law, regulation, legal process, or to protect the rights, property, or safety of Mr LAD, our users, or others.</Bullet>
            <Bullet>Business transfers — in connection with a merger, acquisition, financing, or sale of assets.</Bullet>
          </Section>

          <Section title="8. International data transfers">
            <Para>
              We are based in the United Arab Emirates and use service providers that may process data in other countries. Where we transfer personal data across borders, we take steps to ensure an appropriate level of protection, such as relying on adequacy decisions or standard contractual clauses where applicable.
            </Para>
          </Section>

          <Section title="9. Data retention">
            <Para>
              We retain personal data for as long as needed to provide the Services, comply with our legal obligations, resolve disputes, and enforce our agreements. Customer Data is retained according to our agreement with the Customer and is deleted or returned on termination, subject to legal retention requirements.
            </Para>
          </Section>

          <Section title="10. Security">
            <Para>
              We implement technical and organizational measures designed to protect personal data, including encryption in transit, access controls, tenant data isolation, and authentication safeguards. No method of transmission or storage is completely secure. If you believe your account has been compromised, contact us immediately.
            </Para>
          </Section>

          <Section title="11. Your rights and choices">
            <Para>
              Subject to applicable law, you may have the right to access, correct, update, delete, or port your personal data; to object to or restrict certain processing; and to withdraw consent. To exercise these rights, contact us using the details below. You also have the right to lodge a complaint with a data protection authority.
            </Para>
          </Section>

          <Section title="12. Cookies">
            <Para>
              We use cookies and similar technologies to operate the Services, remember your preferences, and analyze usage. For full details and how to manage them, see our Cookies Policy.
            </Para>
          </Section>

          <Section title="13. Children's privacy">
            <Para>
              The Services are intended for business use and are not directed to individuals under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us so we can delete it.
            </Para>
          </Section>

          <Section title="14. Third-party links and services">
            <Para>
              The Services may link to or integrate with third-party websites and platforms that we do not control. This Privacy Policy does not apply to those third parties, and we encourage you to review their privacy policies.
            </Para>
          </Section>

          <Section title="15. Changes to this policy">
            <Para>
              We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date above and, where appropriate, provide additional notice. Your continued use of the Services after changes take effect constitutes acceptance of the updated policy.
            </Para>
          </Section>

          <Section title="16. Contact us">
            <Para>If you have questions about this Privacy Policy or our data practices, contact us at:</Para>
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
