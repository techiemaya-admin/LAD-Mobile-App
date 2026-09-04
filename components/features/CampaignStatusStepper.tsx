import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Bell,
  Check,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Reply,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import type { WorkflowStepDisplay } from '@/src/services/campaignActivity';

type IconComponent = React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const STEP_TYPE_ICON: Record<string, IconComponent> = {
  linkedin_visit: Eye,
  linkedin_connect: UserPlus,
  linkedin_message: MessageSquare,
  linkedin_follow: Bell,
  wait_for_condition: UserCheck,
  voice_agent_call: Phone,
  voice_call: Phone,
  call: Phone,
  email_send: Mail,
  email: Mail,
  whatsapp_send: MessageCircle,
  whatsapp: MessageCircle,
  sms: Smartphone,
  reply: Reply,
  lead_generation: Users,
  delay: Clock,
};

/** Port of LAD-Frontend-2's StatusStepper.tsx — RN version (no CSS/tooltips). */
export function CampaignStatusStepper({ currentStep, steps }: { currentStep: number; steps: WorkflowStepDisplay[] }) {
  const appTheme = useAppTheme();

  if (!steps.length) return null;

  const getState = (stepId: number): 'completed' | 'active' | 'upcoming' => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'upcoming';
  };

  const completedBg = appTheme.darkMode ? '#2563EB' : '#0B1957';
  const activeBorder = appTheme.darkMode ? '#60A5FA' : '#0B1957';
  const upcomingBg = appTheme.darkMode ? '#1A2A43' : '#F1F5F9';
  const upcomingBorder = appTheme.darkMode ? '#262831' : '#CBD5E1';
  const upcomingIcon = appTheme.darkMode ? '#CBD5E1' : '#94A3B8';
  const connectorDone = completedBg;
  const connectorPending = appTheme.darkMode ? '#262831' : '#D9D9D9';

  return (
    <View style={styles.row}>
      {steps.map((step, index) => {
        const state = getState(step.id);
        const isLast = index === steps.length - 1;
        const Icon = STEP_TYPE_ICON[step.type] ?? Zap;
        const nodeStyle = state === 'completed'
          ? { backgroundColor: completedBg, borderColor: completedBg }
          : state === 'active'
            ? { backgroundColor: appTheme.surface, borderColor: activeBorder, borderWidth: 2 }
            : { backgroundColor: upcomingBg, borderColor: upcomingBorder, borderWidth: 2 };
        const iconColor = state === 'completed' ? '#FFFFFF' : state === 'active' ? activeBorder : upcomingIcon;

        return (
          <React.Fragment key={step.id}>
            <View style={styles.nodeWrap}>
              <View style={[styles.node, nodeStyle]}>
                <Icon color={iconColor} size={14} strokeWidth={2} />
              </View>
              {state === 'completed' ? (
                <View style={[styles.checkBadge, { backgroundColor: '#10B981', borderColor: appTheme.surface }]}>
                  <Check color="#FFFFFF" size={8} strokeWidth={3} />
                </View>
              ) : null}
              <Typography
                variant="caption"
                color={state === 'upcoming' ? appTheme.disabled : appTheme.text}
                numberOfLines={1}
                style={styles.stepLabel}
              >
                {step.label}
              </Typography>
            </View>
            {!isLast ? (
              <View style={[styles.connector, { backgroundColor: state === 'completed' ? connectorDone : connectorPending }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    paddingVertical: 8,
  },
  nodeWrap: {
    alignItems: 'center',
    width: 56,
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 18,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepLabel: {
    marginTop: 4,
    fontSize: 10,
    textAlign: 'center',
  },
  connector: {
    height: 2,
    flex: 1,
    marginTop: 14,
    marginHorizontal: -8,
  },
});
