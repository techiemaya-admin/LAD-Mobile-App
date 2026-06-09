import React from 'react';
import { Platform, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Bot } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';

const WEB_TEXT_WRAP = Platform.OS === 'web'
  ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as any)
  : null;

interface MessageBubbleProps {
  text: string;
  time: string;
  isMe: boolean;
  isAI?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ text, time, isMe, isAI }) => {
  const appTheme = useAppTheme();
  const { width } = useWindowDimensions();
  const bubbleMaxWidth = width < 520 ? Math.max(180, width - 88) : Math.min(width * 0.72, 720);

  return (
    <View style={[
      styles.wrapper,
      isMe ? styles.wrapperMe : styles.wrapperThem
    ]}>
      {!isMe && isAI ? (
        <View style={[styles.agentAvatar, { backgroundColor: appTheme.infoSoft, borderColor: appTheme.border }]}>
          <Bot color={appTheme.primaryAccent} size={16} />
        </View>
      ) : null}
      <View style={[
        styles.container,
        { maxWidth: bubbleMaxWidth },
        isMe
          ? styles.containerMe
          : isAI
            ? [
              styles.containerAI,
              {
                backgroundColor: appTheme.darkMode ? appTheme.softSurface : Theme.colors.infoLight,
                borderColor: appTheme.darkMode ? appTheme.border : Theme.colors.info,
              },
            ]
            : [
              styles.containerThem,
              {
                backgroundColor: appTheme.surface,
                borderColor: appTheme.border,
              },
            ],
      ]}>
        {isAI && (
          <Typography variant="overline" color={appTheme.primaryAccent} style={{ marginBottom: 4 }}>
            AI Assistant
          </Typography>
        )}
        <Typography 
          variant="body" 
          color={isMe ? Theme.colors.surface : appTheme.text}
          style={[styles.messageText, WEB_TEXT_WRAP]}
        >
          {text}
        </Typography>
        <Typography 
          variant="caption" 
          color={isMe ? 'rgba(255,255,255,0.7)' : appTheme.muted}
          style={styles.time}
        >
          {time}
        </Typography>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Theme.spacing.md,
    width: '100%',
  },
  wrapperMe: {
    justifyContent: 'flex-end',
  },
  wrapperThem: {
    justifyContent: 'flex-start',
  },
  container: {
    minWidth: 88,
    flexShrink: 1,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    ...Theme.shadows.small,
  },
  containerMe: {
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  containerThem: {
    backgroundColor: Theme.colors.surface,
    borderBottomLeftRadius: 4,
  },
  containerAI: {
    backgroundColor: Theme.colors.infoLight,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Theme.colors.info,
  },
  agentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.xs,
    marginBottom: 2,
  },
  messageText: {
    flexShrink: 1,
  },
  time: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 10,
  },
});
