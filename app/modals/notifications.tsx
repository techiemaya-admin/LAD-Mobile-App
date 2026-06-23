import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Bell, Mail, MessageCircle, Phone, BriefcaseBusiness, Camera } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppTheme } from '@/src/theme/appTheme';
import { useChatStore, type ChatChannel, type Conversation } from '@/src/store/chatStore';

type NotificationItem = {
  id: string;
  conversationId: string;
  channel: ChatChannel;
  title: string;
  description: string;
  timestamp?: string;
  unreadCount: number;
  read: boolean;
};

function rel(from?: string) {
  if (!from) return 'Just now';
  const date = new Date(from);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function toNotification(conversation: Conversation): NotificationItem {
  const unreadCount = Number(conversation.unreadCount || 0);
  return {
    id: conversation.id,
    conversationId: conversation.id,
    channel: conversation.channel,
    title: conversation.name || 'New message',
    description: conversation.lastMessage || 'New message received',
    timestamp: conversation.lastMessageAt,
    unreadCount,
    read: unreadCount <= 0,
  };
}

export default function NotificationsModal() {
  const router = useRouter();
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const conversations = useChatStore((state) => state.conversations);
  const isLoadingConversations = useChatStore((state) => state.isLoadingConversations);
  const isSyncing = useChatStore((state) => state.isSyncing);
  const error = useChatStore((state) => state.error || state.syncError);
  const initializeRealtime = useChatStore((state) => state.initializeRealtime);
  const fetchConversations = useChatStore((state) => state.fetchConversations);
  const syncConversations = useChatStore((state) => state.syncConversations);
  const startConversationAutoSync = useChatStore((state) => state.startConversationAutoSync);
  const stopConversationAutoSync = useChatStore((state) => state.stopConversationAutoSync);
  const markConversationRead = useChatStore((state) => state.markConversationRead);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    try {
      initializeRealtime();
      startConversationAutoSync();
      void fetchConversations().catch(() => undefined);
    } catch {
      void fetchConversations().catch(() => undefined);
    }
    return () => {
      stopConversationAutoSync();
    };
  }, [fetchConversations, initializeRealtime, startConversationAutoSync, stopConversationAutoSync]);

  const notifications = useMemo(() => {
    const ordered = [...conversations]
      .sort((a, b) => Date.parse(b.lastMessageAt || '') - Date.parse(a.lastMessageAt || ''))
      .map(toNotification);
    const unread = ordered.filter((item) => !item.read);
    const recentRead = ordered.filter((item) => item.read).slice(0, Math.max(0, 12 - unread.length));
    return [...unread, ...recentRead];
  }, [conversations]);

  const unreadTotal = notifications.reduce((sum, item) => sum + item.unreadCount, 0);
  const loading = isLoadingConversations && !notifications.length;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncConversations({ silent: true, force: true });
    } catch {
      // The chat store keeps the sync error for the visible error card.
    } finally {
      setRefreshing(false);
    }
  };

  const getIcon = (channel: ChatChannel) => {
    switch (String(channel)) {
      case 'whatsapp':
        return <MessageCircle color={Theme.colors.success} size={20} />;
      case 'linkedin':
        return <BriefcaseBusiness color={Theme.colors.info} size={20} />;
      case 'email':
        return <Mail color={Theme.colors.error} size={20} />;
      case 'instagram':
        return <Camera color="#E1306C" size={20} />;
      case 'voice':
        return <Phone color={appTheme.primaryAccent} size={20} />;
      default:
        return <Bell color={appTheme.muted} size={20} />;
    }
  };

  const openNotification = (notification: NotificationItem) => {
    if (!notification.read) {
      markConversationRead(notification.conversationId);
    }
    router.replace('/chats');
  };

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
        <View>
          <Typography variant="h3" color={appTheme.text}>Notifications</Typography>
          <Typography variant="caption" color={appTheme.muted}>
            {unreadTotal ? `${unreadTotal} unread from live conversations` : 'Live conversation updates'}
          </Typography>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: appTheme.softSurface }]}>
          <X color={appTheme.text} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing || isSyncing}
            onRefresh={() => void refresh()}
            tintColor={appTheme.primaryAccent}
          />
        )}
      >
        {loading ? (
          <View style={[styles.emptyState, { borderColor: appTheme.border, backgroundColor: appTheme.surface }]}>
            <ActivityIndicator color={appTheme.primaryAccent} />
            <Typography variant="bodySmall" color={appTheme.muted}>Loading live notifications...</Typography>
          </View>
        ) : error ? (
          <View style={[styles.errorState, { borderColor: appTheme.darkMode ? 'rgba(248, 113, 113, 0.38)' : Theme.colors.errorLight }]}>
            <Typography variant="bodySmall" color={appTheme.darkMode ? '#FCA5A5' : Theme.colors.error}>
              {error}
            </Typography>
          </View>
        ) : null}

        {!loading && !notifications.length ? (
          <View style={[styles.emptyState, { borderColor: appTheme.border, backgroundColor: appTheme.surface }]}>
            <Bell color={appTheme.muted} size={26} />
            <Typography variant="bodySmall" color={appTheme.text} style={styles.emptyTitle}>No new notifications</Typography>
            <Typography variant="caption" color={appTheme.muted} style={styles.emptyCopy}>
              Incoming backend conversation updates will appear here in real time.
            </Typography>
          </View>
        ) : null}

        {notifications.map((notif) => (
          <TouchableOpacity key={notif.id} activeOpacity={0.84} onPress={() => openNotification(notif)}>
            <GlassCard
              style={[
                styles.notificationCard,
                {
                  backgroundColor: appTheme.surface,
                  borderColor: notif.read ? appTheme.border : appTheme.primaryAccent,
                },
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: appTheme.softSurface }]}>
                {getIcon(notif.channel)}
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Typography variant="bodyLarge" color={appTheme.text} style={{ fontWeight: notif.read ? '500' : '700', flex: 1 }} numberOfLines={1}>
                    {notif.title}
                  </Typography>
                  <Typography variant="caption" color={appTheme.muted}>{rel(notif.timestamp)}</Typography>
                </View>
                <Typography variant="bodySmall" color={appTheme.muted} style={{ marginTop: 4 }} numberOfLines={2}>
                  {notif.description}
                </Typography>
                {notif.unreadCount > 1 ? (
                  <Typography variant="caption" color={appTheme.primaryAccent} style={styles.unreadCount}>
                    {notif.unreadCount} unread messages
                  </Typography>
                ) : null}
              </View>
              {!notif.read && <View style={[styles.unreadDot, { backgroundColor: appTheme.primaryAccent }]} />}
            </GlassCard>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
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
    paddingBottom: Theme.spacing.xxl,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    alignItems: 'flex-start',
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
    gap: Theme.spacing.sm,
  },
  unreadCount: {
    marginTop: Theme.spacing.xs,
    fontWeight: '900',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.primary,
    marginLeft: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  emptyState: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: Theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.xl,
  },
  emptyTitle: {
    fontWeight: '900',
  },
  emptyCopy: {
    textAlign: 'center',
  },
  errorState: {
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
  },
});
