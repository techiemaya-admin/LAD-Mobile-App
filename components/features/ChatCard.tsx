import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { GlassCard } from '@/components/ui/GlassCard';
import { Check, CheckCheck } from 'lucide-react-native';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  avatar: string;
  online?: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

interface ChatCardProps {
  chat: Chat;
  onPress?: () => void;
}

export const ChatCard: React.FC<ChatCardProps> = ({ chat, onPress }) => {
  const renderStatus = () => {
    if (!chat.status) return null;
    
    switch (chat.status) {
      case 'read':
        return CheckCheck ? <CheckCheck size={16} color={Theme.colors.info} /> : <Check size={16} color={Theme.colors.info} />;
      case 'delivered':
        return CheckCheck ? <CheckCheck size={16} color={Theme.colors.textDisabled} /> : <Check size={16} color={Theme.colors.textDisabled} />;
      case 'sent':
        return Check ? <Check size={16} color={Theme.colors.textDisabled} /> : null;
      default:
        return null;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <GlassCard style={styles.container}>
        <View style={styles.avatarContainer}>
          <Avatar src={chat.avatar} fallback={chat.name[0]} size="lg" />
          {chat.online && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Typography variant="h4" numberOfLines={1}>{chat.name}</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>{chat.time}</Typography>
          </View>

          <View style={styles.footer}>
            <View style={styles.messageRow}>
              {renderStatus()}
              <Typography 
                variant="bodySmall" 
                numberOfLines={1} 
                style={[styles.lastMessage, { marginLeft: chat.status ? 4 : 0 }]}
              >
                {chat.lastMessage}
              </Typography>
            </View>

            {chat.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Typography variant="overline" color={Theme.colors.surface} style={{ fontWeight: '800' }}>
                  {chat.unreadCount}
                </Typography>
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.sm,
    alignItems: 'center',
    padding: 0,
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.surface,
  },
  content: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  lastMessage: {
    flex: 1,
    color: Theme.colors.textSecondary,
  },
  unreadBadge: {
    backgroundColor: Theme.colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});
