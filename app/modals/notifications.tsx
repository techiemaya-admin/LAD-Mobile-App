import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Bell, UserPlus, Megaphone, Bot } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppTheme } from '@/src/theme/appTheme';

export default function NotificationsModal() {
  const router = useRouter();
  const appTheme = useAppTheme();

  const notifications = [
    { id: 1, type: 'ai', title: 'Smart Insight', time: '10m ago', desc: 'Campaign "Q3 Outreach" has a 15% higher open rate than average.', read: false },
    { id: 2, type: 'lead', title: 'New Hot Lead', time: '1h ago', desc: 'Sarah Jenkins from TechCorp just opened your proposal.', read: false },
    { id: 3, type: 'campaign', title: 'Campaign Completed', time: '2h ago', desc: 'The "Onboarding Sequence" has finished sending to 500 contacts.', read: true },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'ai': return <Bot color={appTheme.primaryAccent} size={20} />;
      case 'lead': return <UserPlus color={Theme.colors.success} size={20} />;
      case 'campaign': return <Megaphone color={Theme.colors.info} size={20} />;
      default: return <Bell color={appTheme.muted} size={20} />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      <View style={[styles.header, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
        <Typography variant="h3" color={appTheme.text}>Notifications</Typography>
        <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: appTheme.softSurface }]}>
          <X color={appTheme.text} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notifications.map((notif) => (
          <GlassCard
            key={notif.id}
            style={[
              styles.notificationCard,
              {
                backgroundColor: appTheme.surface,
                borderColor: notif.read ? appTheme.border : appTheme.primaryAccent,
              },
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: appTheme.softSurface }]}>
              {getIcon(notif.type)}
            </View>
            <View style={styles.notifContent}>
              <View style={styles.notifHeader}>
                <Typography variant="bodyLarge" color={appTheme.text} style={{ fontWeight: notif.read ? '500' : '700' }}>{notif.title}</Typography>
                <Typography variant="caption" color={appTheme.darkMode ? '#FFFFFF' : appTheme.muted}>{notif.time}</Typography>
              </View>
              <Typography variant="bodySmall" color={appTheme.darkMode ? '#FFFFFF' : appTheme.muted} style={{ marginTop: 4 }}>
                {notif.desc}
              </Typography>
            </View>
            {!notif.read && <View style={[styles.unreadDot, { backgroundColor: appTheme.primaryAccent }]} />}
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    marginTop: 40,
    borderTopLeftRadius: Theme.radius.xl,
    borderTopRightRadius: Theme.radius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
  },
  closeBtn: {
    padding: Theme.spacing.xs,
    borderRadius: Theme.radius.full,
  },
  content: {
    padding: Theme.spacing.xl,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primary,
    marginLeft: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
});
