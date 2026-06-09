import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet, TouchableOpacity } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { CallRecord } from '@/types/calls';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  Phone,
} from 'lucide-react-native';
import { useAppTheme } from '@/src/theme/appTheme';

interface CallCardProps {
  call: CallRecord;
  onPress?: () => void;
}

const temperatureVariants = {
  hot: 'error',
  warm: 'warning',
  cold: 'info',
} as const;

const formatDuration = (duration: number) => {
  if (duration < 60) {
    return `${duration}s`;
  }

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}m ${seconds}s`;
};

/** Returns a label + colour for "live" call statuses that deserve extra prominence. */
const getActiveStatusMeta = (status: string): { label: string; color: string } | null => {
  switch (status) {
    case 'queued':
      return { label: 'Queued', color: '#F59E0B' };
    case 'ringing':
      return { label: 'Ringing', color: '#3B82F6' };
    case 'in_progress':
      return { label: 'In progress', color: '#10B981' };
    default:
      return null;
  }
};

/** Pulsing animated dot to indicate a live status. */
function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.55, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.pulsingDotWrap}>
      <Animated.View style={[styles.pulsingDotOuter, { backgroundColor: color, transform: [{ scale }], opacity }]} />
      <View style={[styles.pulsingDotInner, { backgroundColor: color }]} />
    </View>
  );
}

export const CallCard: React.FC<CallCardProps> = memo(({ call, onPress }) => {
  const appTheme = useAppTheme();
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const activeStatus = getActiveStatusMeta(call.callStatus);
  const isManualDial = call.type === 'manual-dial';
  const isMissedManualDial = isManualDial && (
    call.callStatus === 'failed' ||
    call.callStatus === 'no-answer' ||
    call.callStatus === 'dropped'
  );
  const displayName = isManualDial ? 'Manual dial' : call.name;

  const renderIcon = () => {
    switch (call.type) {
      case 'incoming':
        return PhoneIncoming ? <PhoneIncoming size={14} color="#10B981" /> : <Phone size={14} color="#10B981" />;
      case 'outgoing':
        return PhoneOutgoing ? <PhoneOutgoing size={14} color="#6366F1" /> : <Phone size={14} color="#6366F1" />;
      case 'manual-dial':
        if (isMissedManualDial) {
          return PhoneMissed ? <PhoneMissed size={14} color="#EF4444" /> : <Phone size={14} color="#EF4444" />;
        }
        return PhoneOutgoing ? <PhoneOutgoing size={14} color="#0F766E" /> : <Phone size={14} color="#0F766E" />;
      case 'missed':
        return PhoneMissed ? <PhoneMissed size={14} color="#EF4444" /> : <Phone size={14} color="#EF4444" />;
      case 'video':
        return Video ? <Video size={14} color="#10B981" /> : <Phone size={14} color="#10B981" />;
      default:
        return <Phone size={14} color={appTheme.muted} />;
    }
  };

  const getTypeLabel = () => {
    switch (call.type) {
      case 'incoming': return 'Voice Call';
      case 'outgoing': return 'Voice Call';
      case 'manual-dial': return isMissedManualDial ? 'Missed Call' : 'Voice Call';
      case 'missed': return 'Missed Call';
      case 'video': return 'Video Call';
      default: return 'Voice Call';
    }
  };

  return (
    <GlassCard style={styles.container}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.touchTarget}>
        <View style={styles.avatarContainer}>
          <Avatar src={call.avatar} fallback={displayName[0]} size="md" />
          {call.statusColor && (
            <View style={[styles.statusDot, { backgroundColor: call.statusColor }]} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.mainInfo}>
            <View style={styles.nameBlock}>
              <Typography variant="h4" style={[styles.name, { color: appTheme.text }]} numberOfLines={1}>
                {displayName} {call.count && call.count > 1 ? `(${call.count})` : ''}
              </Typography>
              <View style={styles.typeRow}>
                {renderIcon()}
                <Typography variant="bodySmall" style={[styles.typeText, { color: appTheme.muted }]}>
                  {getTypeLabel()}
                </Typography>
                <View style={styles.metaDot} />
                <Typography variant="bodySmall" style={[styles.typeText, { color: appTheme.muted }]}>
                  {formatDuration(call.duration)}
                </Typography>
              </View>
            </View>
            <View style={styles.rightMeta}>
              <Typography variant="caption" color={appTheme.disabled} style={styles.timeText}>
                {call.time}
              </Typography>
              <Badge
                label={call.leadTemperature}
                variant={temperatureVariants[call.leadTemperature]}
                style={styles.temperatureBadge}
              />
            </View>
          </View>

          {/* Live status banner — only shown for queued / ringing / in_progress */}
          {activeStatus ? (
            <View style={[styles.activeStatusRow, { backgroundColor: `${activeStatus.color}14`, borderColor: `${activeStatus.color}30` }]}>
              <PulsingDot color={activeStatus.color} />
              <Typography variant="caption" style={[styles.activeStatusText, { color: activeStatus.color }]}>
                {activeStatus.label}
              </Typography>
            </View>
          ) : (
            <View style={styles.callMeta}>
              <Typography variant="caption" color={appTheme.muted}>
                {call.callStatus.replace('-', ' ')}
              </Typography>
              <Typography variant="caption" color={appTheme.muted}>
                Score {call.engagement_score}
              </Typography>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.summaryToggle}
        onPress={() => setIsSummaryOpen((value) => !value)}
        activeOpacity={0.7}
      >
        <View style={styles.summaryLabel}>
          <Bot color={appTheme.primaryAccent} size={16} />
          <Typography variant="bodySmall" style={[styles.summaryTitle, { color: appTheme.primaryAccent }]}>AI Summary</Typography>
        </View>
        {isSummaryOpen ? (
          <ChevronUp color={appTheme.muted} size={18} />
        ) : (
          <ChevronDown color={appTheme.muted} size={18} />
        )}
      </TouchableOpacity>

      {isSummaryOpen && (
        <View style={styles.summaryBody}>
          <Typography variant="bodySmall" style={[styles.summaryLine, { color: appTheme.muted }]}>
            Intent: {call.aiSummary.customerIntent}
          </Typography>
          <Typography variant="bodySmall" style={[styles.summaryLine, { color: appTheme.muted }]}>
            Outcome: {call.aiSummary.callOutcome}
          </Typography>
          <Typography variant="bodySmall" style={[styles.summaryLine, { color: appTheme.muted }]}>
            Points: {call.aiSummary.discussionPoints.join(' ')}
          </Typography>
          <Typography variant="bodySmall" style={[styles.summaryLine, { color: appTheme.muted }]}>
            Follow-up: {call.aiSummary.followUpSuggestion}
          </Typography>
        </View>
      )}
    </GlassCard>
  );
});

CallCard.displayName = 'CallCard';

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.sm,
    padding: Theme.spacing.md,
  },
  touchTarget: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
  content: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  mainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameBlock: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeText: {
    fontSize: 14,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.textDisabled,
  },
  rightMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    marginTop: 4,
  },
  temperatureBadge: {
    alignSelf: 'flex-end',
  },
  callMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.sm,
  },
  // Live status indicator
  activeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  activeStatusText: {
    fontWeight: '700',
    fontSize: 12,
  },
  pulsingDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingDotOuter: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pulsingDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryToggle: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.borderLight,
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  summaryTitle: {
    fontWeight: '700',
    color: Theme.colors.primary,
  },
  summaryBody: {
    marginTop: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  summaryLine: {
  },
});
