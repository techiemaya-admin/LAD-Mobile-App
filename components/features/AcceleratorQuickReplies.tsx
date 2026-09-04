import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Typography } from '@/components/ui/Typography';
import type { BusinessProfile } from '@/src/services/aiPlaygroundService';
import type { TemplateInput, WorkflowTemplate } from '@/src/services/workflowAccelerators';

export interface AcceleratorQuickReply {
  label: string;
  value: string;
  hint?: string;
}

/** Mirrors LAD Frontend 2's data-backed quick replies without inventing values. */
export function getAcceleratorQuickReplies(
  question: TemplateInput | undefined,
  template: WorkflowTemplate,
  profile?: BusinessProfile | null,
): AcceleratorQuickReply[] {
  if (!question || question.target === 'gate') return [];
  const replies: AcceleratorQuickReply[] = [];

  const icpFor: Record<string, string | undefined> = {
    job_titles: typeof profile?.icpJobTitles === 'string' ? profile.icpJobTitles : undefined,
    industries: typeof profile?.industry === 'string' ? profile.industry : undefined,
    locations: typeof profile?.icpLocations === 'string'
      ? profile.icpLocations
      : typeof profile?.geographicFocus === 'string'
        ? profile.geographicFocus
        : undefined,
  };
  const fromIcp = (icpFor[question.key] || '').trim();
  if (fromIcp) replies.push({ label: 'Use my ICP', value: fromIcp, hint: fromIcp });

  const sourceConfig = template.source?.cfg as Record<string, unknown> | undefined;
  const preset = String(sourceConfig?.[question.key] || '').trim();
  if (question.optional) {
    if (question.target === 'node') {
      replies.push({ label: 'Let Mr LAD write it', value: 'skip' });
    } else if (preset && preset !== fromIcp) {
      replies.push({ label: 'Keep the suggested', value: 'skip', hint: preset });
    } else {
      replies.push({ label: 'Skip', value: 'skip' });
    }
  }

  return replies;
}

export function AcceleratorQuickReplies({
  replies,
  onOption,
  darkMode,
}: {
  replies: AcceleratorQuickReply[];
  onOption: (value: string) => void;
  darkMode: boolean;
}) {
  if (!replies.length) return null;
  return (
    <View style={styles.wrap}>
      {replies.map((reply) => (
        <TouchableOpacity
          key={`${reply.label}-${reply.value}`}
          activeOpacity={0.74}
          accessibilityRole="button"
          accessibilityLabel={reply.hint ? `${reply.label}: ${reply.hint}` : reply.label}
          onPress={() => onOption(`__role_answer__:${reply.value}`)}
          style={[
            styles.reply,
            {
              backgroundColor: darkMode ? '#0F172A' : '#FFFFFF',
              borderColor: darkMode ? '#334155' : '#DCE3EC',
            },
          ]}
        >
          <Typography variant="caption" color={darkMode ? '#F8FAFC' : '#334155'} style={styles.label}>
            {reply.label}
          </Typography>
          {reply.hint ? (
            <Typography
              variant="caption"
              color={darkMode ? '#64748B' : '#8AA0BF'}
              style={styles.hint}
              numberOfLines={1}
            >
              {reply.hint}
            </Typography>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reply: {
    maxWidth: '100%',
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    flexShrink: 0,
    fontWeight: '600',
  },
  hint: {
    flexShrink: 1,
    minWidth: 0,
  },
});
