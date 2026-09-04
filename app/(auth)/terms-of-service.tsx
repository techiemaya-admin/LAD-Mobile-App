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

export default function TermsOfServiceScreen() {
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
          <TouchableOpacity style={[styles.tab, styles.tabActive]} activeOpacity={0.85}>
            <Typography style={styles.tabTextActive}>Terms of Service</Typography>
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
          <Typography variant="h1" style={styles.headerTitle}>Terms of Service</Typography>
          <Typography variant="bodySmall" style={styles.headerDate}>Last updated: May 29, 2026</Typography>
        </View>

        {/* Intro */}
        <View style={styles.card}>
          <Para>
            These Terms of Service govern your access to and use of Mr LAD. Please read them carefully. By creating an account or using the Services, you agree to be bound by these terms.
          </Para>
        </View>

        {/* Sections */}
        <View style={styles.card}>
          <Section title="1. Agreement to terms">
            <Para>
              These Terms of Service ("Terms") form a binding agreement between you (and the organization you represent, "you" or "Customer") and TechieMaya FZE, operator of Mr LAD ("Mr LAD", "we", "us", or "our"), based at IDS Business Center, Al Karama, Dubai, United Arab Emirates. By accessing or using mrlads.com or the Services, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Services.
            </Para>
          </Section>

          <Section title="2. Definitions">
            <Bullet>"Services" means the Mr LAD platform, website, applications, APIs, and related features.</Bullet>
            <Bullet>"Customer Data" means data you submit to, generate within, or process through the Services, including data about your leads, prospects, and contacts.</Bullet>
            <Bullet>"Account" means the account you register to access the Services.</Bullet>
          </Section>

          <Section title="3. The Services">
            <Para>
              Mr LAD provides AI-powered tools to run outreach, engagement, nurture, and analytics across channels such as LinkedIn, WhatsApp, Instagram, email, advertising, and voice. The Services may evolve over time, and we may add, modify, or remove features. Certain features depend on third-party platforms and are subject to their availability and terms.
            </Para>
          </Section>

          <Section title="4. Eligibility and accounts">
            <Bullet>You must be at least 18 years old and able to form a binding contract.</Bullet>
            <Bullet>You are responsible for the accuracy of your registration information and for keeping it up to date.</Bullet>
            <Bullet>You are responsible for safeguarding your credentials and for all activity under your Account. Notify us promptly of any unauthorized use.</Bullet>
            <Bullet>You are responsible for your authorized users' compliance with these Terms.</Bullet>
          </Section>

          <Section title="5. Subscriptions, credits, and billing">
            <Bullet>Paid features are offered on a subscription and/or usage (credit/wallet) basis as described at the point of purchase.</Bullet>
            <Bullet>Fees are charged in advance or as consumed, depending on the plan. Usage-based charges (including AI, messaging, and voice usage) are deducted from your wallet or billed per your plan.</Bullet>
            <Bullet>Unless required by law or stated otherwise, fees are non-refundable and payments are non-cancelable.</Bullet>
            <Bullet>You authorize us and our payment processor to charge your designated payment method for amounts due. You are responsible for any applicable taxes.</Bullet>
            <Bullet>We may change pricing prospectively; we will provide reasonable notice of material changes to recurring fees.</Bullet>
          </Section>

          <Section title="6. Acceptable use">
            <Para>You agree not to, and not to permit others to:</Para>
            <Bullet>Use the Services for unlawful, deceptive, harmful, or fraudulent purposes, or to send spam or unsolicited communications in violation of applicable law;</Bullet>
            <Bullet>Violate the terms, policies, or rate limits of any connected third-party platform (including LinkedIn, WhatsApp/Meta, Instagram, email providers, and telephony providers);</Bullet>
            <Bullet>Send messages to recipients without a lawful basis or required consent, or contact individuals who have opted out;</Bullet>
            <Bullet>Upload or transmit malicious code, or attempt to gain unauthorized access to the Services or related systems;</Bullet>
            <Bullet>Reverse engineer, scrape, resell, or build a competing product from the Services except to the extent permitted by law;</Bullet>
            <Bullet>Infringe the intellectual property or privacy rights of others;</Bullet>
            <Bullet>Interfere with or disrupt the integrity or performance of the Services.</Bullet>
          </Section>

          <Section title="7. Customer Data and your responsibilities">
            <Para>
              You retain all rights to your Customer Data. You grant us a worldwide, non-exclusive license to host, process, and use Customer Data solely to provide and improve the Services and as instructed by you. You represent and warrant that you have all necessary rights, consents, and legal bases to provide the Customer Data and to conduct the outreach and communications you carry out through the Services, and that doing so complies with applicable laws and third-party platform terms.
            </Para>
          </Section>

          <Section title="8. Third-party services and platforms">
            <Para>
              The Services integrate with third-party platforms and providers. Your use of those integrations is subject to the applicable third party's terms and policies. We are not responsible for third-party services, their availability, or any changes they make that affect the Services.
            </Para>
          </Section>

          <Section title="9. AI-generated content">
            <Para>
              The Services use AI to generate content and suggestions. AI output may be inaccurate, incomplete, or unsuitable for your purpose. You are solely responsible for reviewing, editing, and approving any content before it is used or sent, and for ensuring it complies with applicable laws and platform policies. We make no warranty regarding the accuracy or suitability of AI-generated output.
            </Para>
          </Section>

          <Section title="10. Intellectual property">
            <Para>
              The Services, including all software, design, text, and other materials (excluding Customer Data), are owned by TechieMaya FZE or its licensors and are protected by intellectual property laws. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable right to access and use the Services for your internal business purposes. All rights not expressly granted are reserved.
            </Para>
          </Section>

          <Section title="11. Feedback">
            <Para>
              If you provide suggestions or feedback about the Services, you grant us a perpetual, irrevocable, royalty-free license to use it without restriction or obligation to you.
            </Para>
          </Section>

          <Section title="12. Disclaimers">
            <Para>
              The Services are provided "as is" and "as available" without warranties of any kind, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Services will be uninterrupted, error-free, or secure, or that they will produce any particular business result.
            </Para>
          </Section>

          <Section title="13. Limitation of liability">
            <Para>
              To the maximum extent permitted by law, neither party will be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, or goodwill. To the maximum extent permitted by law, our total aggregate liability arising out of or relating to these Terms or the Services will not exceed the amounts you paid to us in the twelve (12) months preceding the event giving rise to the claim.
            </Para>
          </Section>

          <Section title="14. Indemnification">
            <Para>
              You will defend, indemnify, and hold harmless TechieMaya FZE and its affiliates, officers, and employees from and against any claims, damages, liabilities, and expenses (including reasonable legal fees) arising out of or related to your Customer Data, your use of the Services, your communications and campaigns, or your breach of these Terms or applicable law.
            </Para>
          </Section>

          <Section title="15. Term, suspension, and termination">
            <Bullet>These Terms remain in effect while you use the Services. You may stop using the Services and close your Account at any time.</Bullet>
            <Bullet>We may suspend or terminate your access if you breach these Terms, fail to pay fees, create risk or legal exposure, or to comply with law.</Bullet>
            <Bullet>Upon termination, your right to use the Services ends. We may delete Customer Data after a reasonable period. Provisions that by their nature should survive termination will survive.</Bullet>
          </Section>

          <Section title="16. Changes to these Terms">
            <Para>
              We may update these Terms from time to time. When we make material changes, we will update the "Last updated" date above and, where appropriate, provide additional notice. Your continued use of the Services after the changes take effect constitutes acceptance of the updated Terms.
            </Para>
          </Section>

          <Section title="17. Governing law and dispute resolution">
            <Para>
              These Terms are governed by the laws of the United Arab Emirates, as applied in the Emirate of Dubai, without regard to conflict-of-laws principles. The courts of Dubai, UAE will have exclusive jurisdiction over any disputes arising out of or relating to these Terms or the Services, subject to any mandatory rights you may have under applicable law.
            </Para>
          </Section>

          <Section title="18. General">
            <Bullet>Entire agreement. These Terms, together with any order or plan details and our policies referenced here, are the entire agreement between you and us regarding the Services.</Bullet>
            <Bullet>Assignment. You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of assets.</Bullet>
            <Bullet>Severability. If any provision is held unenforceable, the remaining provisions remain in effect.</Bullet>
            <Bullet>Waiver. Failure to enforce any provision is not a waiver of our right to do so later.</Bullet>
            <Bullet>Force majeure. Neither party is liable for delays or failures caused by events beyond its reasonable control.</Bullet>
          </Section>

          <Section title="19. Contact us">
            <Para>If you have questions about these Terms, contact us at:</Para>
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
