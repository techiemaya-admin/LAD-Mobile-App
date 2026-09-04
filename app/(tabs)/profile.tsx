import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Settings,
  Shield,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Sparkles,
  User,
  Bell,
  Mail,
  Zap,
  Megaphone,
  Users,
  Building2,
  Share2,
  BarChart3,
  PhoneCall,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useRouter } from 'expo-router';
import useAuthStore from '@/src/store/authStore';
import { useAppTheme } from '@/src/theme/appTheme';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)');
  };

  const accountSections = [
    {
      title: 'CAMPAIGNS & CRM',
      items: [
        {
          icon: <Megaphone color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#7C3AED',
          title: 'Campaigns',
          subtitle: 'Active outreach and broadcast campaigns',
          route: '/(drawer)/campaigns',
          badge: 'ACTIVE',
        },
        {
          icon: <FolderKanban color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#2563EB',
          title: 'CRM Deals Pipeline',
          subtitle: 'Manage deal stages and leads',
          route: '/(tabs)/crm',
        },
        {
          icon: <PhoneCall color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#059669',
          title: 'Voice Agent & Calls',
          subtitle: 'Call logs and automated dialer',
          route: '/(tabs)/calls',
        },
        {
          icon: <BarChart3 color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#D97706',
          title: 'Analytics & Performance',
          subtitle: 'Conversion metrics and reporting',
          route: '/(drawer)/analytics',
        },
      ],
    },
    {
      title: 'ORGANIZATION & BUSINESS',
      items: [
        {
          icon: <Building2 color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#4F46E5',
          title: 'Business Profile',
          subtitle: 'Company details and brand presence',
          route: '/(drawer)/business-profile',
        },
        {
          icon: <Users color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#0891B2',
          title: 'Team Management',
          subtitle: 'Collaborators, roles, and access',
          route: '/(drawer)/team',
        },
        {
          icon: <Share2 color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#EA580C',
          title: 'Integrations',
          subtitle: 'WhatsApp, LinkedIn, and CRM connections',
          route: '/(drawer)/integrations',
          badge: 'CONNECTED',
        },
      ],
    },
    {
      title: 'ACCOUNT & SECURITY',
      items: [
        {
          icon: <User color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#3B82F6',
          title: 'Account Settings',
          subtitle: 'Profile details and user credentials',
          route: '/(drawer)/settings',
        },
        {
          icon: <Shield color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#10B981',
          title: 'Privacy & Security',
          subtitle: 'Session tokens and access control',
          route: '/(drawer)/settings',
        },
      ],
    },
    {
      title: 'SUBSCRIPTION & WORKFLOWS',
      items: [
        {
          icon: <CreditCard color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#8B5CF6',
          title: 'Billing & Plans',
          subtitle: 'Manage Enterprise subscription and credits',
          route: '/(drawer)/billing',
          badge: 'ENTERPRISE',
        },
        {
          icon: <Sparkles color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#F59E0B',
          title: 'AI Automation & Voice',
          subtitle: 'Voice agent prompts and outreach preferences',
          route: '/(drawer)/settings',
        },
      ],
    },
    {
      title: 'HELP & SYSTEM',
      items: [
        {
          icon: <HelpCircle color="#FFFFFF" size={17} strokeWidth={2.4} />,
          iconBg: '#06B6D4',
          title: 'Help & Support',
          subtitle: 'Guides, FAQs, and contact team',
          route: '/(drawer)/support',
        },
      ],
    },
  ];

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'LAD Member');
  const displayEmail = user?.email || 'Signed in';

  return (
    <AnimatedScreen style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <Typography variant="h1" color={appTheme.text} style={styles.headerTitle}>
          Profile
        </Typography>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        scrollEventThrottle={16}
        decelerationRate="normal"
        onScroll={handleBottomTabScroll}
      >
        {/* iOS-Style Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: appTheme.darkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: appTheme.darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.avatarRing}>
              <Avatar fallback={getInitials(displayName)} size={64} />
            </View>
            <View style={styles.heroMeta}>
              <Typography variant="h3" color={appTheme.text} style={styles.heroName} numberOfLines={1}>
                {displayName}
              </Typography>
              <Typography variant="bodySmall" color={appTheme.muted} style={styles.heroEmail} numberOfLines={1}>
                {displayEmail}
              </Typography>
              <View
                style={[
                  styles.planBadge,
                  {
                    backgroundColor: appTheme.darkMode ? 'rgba(41, 118, 244, 0.18)' : '#EFF6FF',
                    borderColor: appTheme.darkMode ? 'rgba(41, 118, 244, 0.35)' : '#BFDBFE',
                  },
                ]}
              >
                <Zap size={11} color={appTheme.darkMode ? '#60A5FA' : '#2563EB'} style={{ marginRight: 4 }} />
                <Typography
                  variant="caption"
                  color={appTheme.darkMode ? '#60A5FA' : '#2563EB'}
                  style={styles.planText}
                >
                  ENTERPRISE TIER
                </Typography>
              </View>
            </View>
          </View>
        </View>

        {/* Grouped Sections */}
        {accountSections.map((section, sIdx) => (
          <View key={sIdx} style={styles.sectionWrap}>
            <Typography variant="caption" color={appTheme.muted} style={styles.sectionHeader}>
              {section.title}
            </Typography>
            <View
              style={[
                styles.groupCard,
                {
                  backgroundColor: appTheme.darkMode ? 'rgba(30, 41, 59, 0.7)' : '#FFFFFF',
                  borderColor: appTheme.darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              {section.items.map((item, iIdx) => {
                const isLast = iIdx === section.items.length - 1;
                return (
                  <TouchableOpacity
                    key={iIdx}
                    style={styles.rowItem}
                    activeOpacity={0.65}
                    onPress={() => router.push(item.route as any)}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                      {item.icon}
                    </View>
                    <View
                      style={[
                        styles.rowContent,
                        !isLast && [styles.rowBorder, { borderBottomColor: appTheme.borderSoft }],
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body" color={appTheme.text} style={styles.rowTitle}>
                          {item.title}
                        </Typography>
                        {item.subtitle ? (
                          <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                            {item.subtitle}
                          </Typography>
                        ) : null}
                      </View>
                      {item.badge ? (
                        <View
                          style={[
                            styles.rowBadge,
                            {
                              backgroundColor:
                                item.badge === 'ACTIVE'
                                  ? appTheme.darkMode
                                    ? 'rgba(124, 58, 237, 0.2)'
                                    : '#F5F3FF'
                                  : item.badge === 'CONNECTED'
                                    ? appTheme.darkMode
                                      ? 'rgba(16, 185, 129, 0.2)'
                                      : '#ECFDF5'
                                    : appTheme.darkMode
                                      ? 'rgba(41, 118, 244, 0.2)'
                                      : '#EFF6FF',
                            },
                          ]}
                        >
                          <Typography
                            variant="caption"
                            color={
                              item.badge === 'ACTIVE'
                                ? '#8B5CF6'
                                : item.badge === 'CONNECTED'
                                  ? '#10B981'
                                  : '#2563EB'
                            }
                            style={{ fontWeight: '700', fontSize: 10 }}
                          >
                            {item.badge}
                          </Typography>
                        </View>
                      ) : null}
                      <ChevronRight color={appTheme.disabled} size={18} strokeWidth={2.2} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Log Out Row */}
        <View style={styles.sectionWrap}>
          <TouchableOpacity
            style={[
              styles.logoutCard,
              {
                backgroundColor: appTheme.darkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: appTheme.darkMode ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2',
              },
            ]}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <LogOut color="#EF4444" size={18} strokeWidth={2.2} />
            <Typography variant="body" color="#EF4444" style={styles.logoutText}>
              Log Out
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Version info */}
        <Typography variant="caption" color={appTheme.disabled} style={styles.versionText}>
          Mr LAD • Version 1.0.0
        </Typography>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 36,
  },
  heroMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  heroName: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heroEmail: {
    fontSize: 13,
  },
  planBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  planText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 6,
    paddingLeft: 12,
    textTransform: 'uppercase',
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    minHeight: 56,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 14,
    marginLeft: 12,
    gap: 8,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  rowBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    fontWeight: '700',
    fontSize: 15,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
  },
});

const getInitials = (value: string) =>
  value
    .split(/[ @._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
