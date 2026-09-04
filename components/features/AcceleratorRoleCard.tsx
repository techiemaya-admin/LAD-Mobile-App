import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  ChevronRight,
  Clock,
  Mail,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Target,
  Upload,
  UsersRound,
  Zap,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { AnimatedQuestionMark } from '@/components/features/AnimatedQuestionMark';
import {
  AcceleratorQuickReplies,
  getAcceleratorQuickReplies,
} from '@/components/features/AcceleratorQuickReplies';
import { useAppTheme } from '@/src/theme/appTheme';
import { AssistantChatMessage } from '@/src/services/mobileAIAssistantService';
import { BusinessProfile } from '@/src/services/aiPlaygroundService';
import {
  WORKFLOW_TEMPLATES,
  splitWizardAnswers,
  templateSearchQuery,
  templateWizardInputs,
  type WorkflowTemplate,
} from '@/src/services/workflowAccelerators';

/** Per-template icon — mirrors LAD Frontend 2's TemplateIcon.tsx (same SVG path for LinkedIn). */
export const AcceleratorTemplateIcon = ({ tplKey, color, size = 16 }: { tplKey: string; color: string; size?: number }) => {
  if (tplKey === 'linkedin_accelerator') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2.4 21.5h5.16V9.75H2.4V21.5zM9.9 9.75h4.95v1.6h.07c.69-1.24 2.37-2.55 4.88-2.55 5.22 0 6.18 3.3 6.18 7.6v5.1h-5.15v-4.52c0-1.08-.02-2.47-1.55-2.47-1.56 0-1.8 1.17-1.8 2.39v4.6H12.3V9.75z"
          transform="scale(0.86) translate(1.6, 1.2)"
        />
      </Svg>
    );
  }
  if (tplKey === 'cold_list_outreach') return <Upload color={color} size={size} />;
  if (tplKey === 'inmail_blitz') return <Mail color={color} size={size} />;
  if (tplKey === 'signal_hunter') return <Zap color={color} size={size} />;
  if (tplKey === 'crm_reengage') return <RefreshCw color={color} size={size} />;
  if (tplKey === 'ai_search_authority') return <Sparkles color={color} size={size} />;
  if (tplKey.includes('real_estate') || tplKey.includes('financial') || tplKey.includes('agency')) return <Building2 color={color} size={size} />;
  if (tplKey.includes('healthcare') || tplKey.includes('recruitment')) return <UsersRound color={color} size={size} />;
  if (tplKey.includes('hvac') || tplKey.includes('logistics')) return <Briefcase color={color} size={size} />;
  return <Target color={color} size={size} />;
};

export const InlineBoldText = ({
  text,
  color,
  variant = 'bodySmall',
  style,
}: {
  text: string;
  color: string;
  variant?: 'caption' | 'bodySmall' | 'body';
  style?: any;
}) => {
  const parts = text.split('**');
  return (
    <Typography variant={variant} color={color} style={style}>
      {parts.map((part, index) => (
        <Typography
          key={`${part}-${index}`}
          variant={variant}
          color={color}
          style={index % 2 ? { fontWeight: '900' } : undefined}
        >
          {part}
        </Typography>
      ))}
    </Typography>
  );
};

/** Workflow chip chain — mirrors LAD Frontend 2's RoleChain (chevron separators, mixed-case labels). */
export const AcceleratorChain = ({ template, compact = false }: { template: WorkflowTemplate; compact?: boolean }) => {
  const appTheme = useAppTheme();
  const items = compact ? template.chain.slice(0, 3) : template.chain;
  return (
    <View style={styles.acceleratorChain}>
      {items.map((item, index) => (
        <React.Fragment key={`${template.key}-${item}-${index}`}>
          {index > 0 ? <ChevronRight color="#94A3B8" size={10} strokeWidth={2.5} /> : null}
          <View style={[styles.acceleratorChainChip, {
            backgroundColor: appTheme.darkMode ? appTheme.labelBackground : `${template.accent}14`,
            borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent',
            borderWidth: appTheme.darkMode ? 1 : 0,
          }]}>
            <Typography variant="overline" color={template.accent} style={styles.acceleratorChainText} numberOfLines={1}>
              {item}
            </Typography>
          </View>
        </React.Fragment>
      ))}
      {compact && template.chain.length > 3 ? (
        <Typography variant="overline" color="#94A3B8" style={styles.acceleratorMoreText}>
          +{template.chain.length - 3}
        </Typography>
      ) : null}
    </View>
  );
};

export const AcceleratorRoleCardView = ({
  card,
  onOption,
  previewing,
  profile,
}: {
  card: NonNullable<AssistantChatMessage['roleCard']>;
  onOption: (value: string) => void;
  previewing?: boolean;
  profile?: BusinessProfile | null;
}) => {
  const appTheme = useAppTheme();
  const template = WORKFLOW_TEMPLATES.find((item) => item.key === card.key);
  if (!template) return null;

  const inputs = templateWizardInputs(template);
  const total = inputs.length;
  const qIdx = Math.min(card.qIdx ?? 0, Math.max(0, total - 1));
  const question = inputs[qIdx];
  const answers = card.answers || {};
  const isQuestionStage = card.stage === 'intro' || card.stage === 'question';
  const quickReplies = getAcceleratorQuickReplies(question, template, profile);
  const previewQuery = card.stage === 'summary'
    ? templateSearchQuery(template, splitWizardAnswers(template, answers).sourceCfg)
    : null;

  return (
    <View style={[styles.roleCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
      <View style={styles.roleCardAccent}>
        <View style={[styles.roleCardAccentStrong, { backgroundColor: template.accent }]} />
        <View style={[styles.roleCardAccentSoft, { backgroundColor: `${template.accent}55` }]} />
      </View>
      <View style={styles.roleCardHeader}>
        <View style={[styles.roleIcon, { backgroundColor: `${template.accent}16` }]}>
          <AcceleratorTemplateIcon tplKey={template.key} color={template.accent} size={17} />
        </View>
        <View style={styles.roleHeaderCopy}>
          <View style={styles.roleTitleRow}>
            <Typography variant="body" color={appTheme.text} style={styles.roleTitle} numberOfLines={2}>
              {template.name}
            </Typography>
            <View style={[styles.roleBadge, {
              backgroundColor: appTheme.darkMode ? appTheme.labelBackground : `${template.accent}14`,
              borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent',
              borderWidth: appTheme.darkMode ? 1 : 0,
            }]}>
              <Typography variant="overline" color={template.accent} style={styles.roleBadgeText}>
                Accelerator
              </Typography>
            </View>
          </View>
          <Typography variant="caption" color={appTheme.muted} style={styles.roleTagline}>
            {template.tagline}
          </Typography>
        </View>
      </View>

      {card.stage === 'intro' || card.stage === 'summary' || card.stage === 'file' ? (
        <View style={styles.roleChainWrap}>
          <AcceleratorChain template={template} />
        </View>
      ) : null}

      {isQuestionStage && question ? (
        <View style={[styles.roleQuestionBlock, { borderTopColor: appTheme.borderSoft }]}>
          <View style={styles.roleProgressRow}>
            <Typography variant="overline" color={appTheme.disabled} style={styles.roleProgressText}>
              Step {qIdx + 1} of {total}
            </Typography>
            <View style={[styles.roleProgressTrack, { backgroundColor: appTheme.softSurface }]}>
              <View style={[styles.roleProgressFill, { width: `${(qIdx / Math.max(1, total)) * 100}%`, backgroundColor: template.accent }]} />
            </View>
          </View>
          {card.nudge ? (
            <View style={styles.roleNudgeRow}>
              <AlertTriangle color={Theme.colors.warning} size={12} strokeWidth={2.5} />
              <Typography variant="caption" color={Theme.colors.warning} style={styles.roleNudge}>
                This answer is required to launch the Accelerator.
              </Typography>
            </View>
          ) : null}
          <View style={[styles.roleQuestionBox, { backgroundColor: '#0B1957' }]}>
            <AnimatedQuestionMark style={styles.roleQuestionMark} />
            <InlineBoldText text={question.question} color="#FFFFFF" variant="bodySmall" style={styles.roleQuestionText} />
          </View>
          {question.target === 'gate' ? (
            <View style={styles.roleButtonRow}>
              <TouchableOpacity activeOpacity={0.82} onPress={() => onOption('__role_gate_yes__')} style={[styles.rolePrimaryBtn, { backgroundColor: template.accent }]}>
                <Typography variant="caption" color="#FFFFFF" style={styles.roleBtnText}>Write them myself</Typography>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.78} onPress={() => onOption('__role_gate_no__')} style={[styles.roleGhostBtn, { borderColor: appTheme.border }]}>
                <Typography variant="caption" color={appTheme.text} style={styles.roleBtnText}>Use suggested copy</Typography>
              </TouchableOpacity>
            </View>
          ) : null}
          {question.suggestion ? (
            <View style={[styles.roleSuggestionBox, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
              <Typography variant="overline" color={appTheme.disabled} style={styles.roleSuggestionLabel}>Suggested if skipped</Typography>
              <Typography variant="caption" color={appTheme.muted} style={styles.roleSuggestionText} numberOfLines={4}>
                {question.suggestion}
              </Typography>
            </View>
          ) : question.target === 'node' ? (
            <Typography variant="caption" color={appTheme.muted} style={styles.roleHint}>
              Skip and Mr LAD writes this from the lead profile and conversation.
            </Typography>
          ) : null}
          <AcceleratorQuickReplies replies={quickReplies} onOption={onOption} darkMode={appTheme.darkMode} />
          {question.target !== 'gate' ? (
            <Typography variant="caption" color={appTheme.disabled} style={styles.roleHint}>
              Type your answer below{question.optional ? ' or pick an option above' : ''}.
            </Typography>
          ) : null}
        </View>
      ) : null}

      {card.stage === 'file' ? (
        <View style={[styles.roleSummaryBlock, { borderTopColor: appTheme.borderSoft }]}>
          <Typography variant="bodySmall" color={appTheme.text} style={styles.roleSummaryCopy}>
            This Accelerator starts from a CSV or Excel file. Open Flow with the pipeline pre-built, then import or map your lead source before launch.
          </Typography>
          <View style={styles.roleButtonRow}>
            <TouchableOpacity activeOpacity={0.82} onPress={() => onOption(`__role_builder__:${template.key}`)} style={[styles.rolePrimaryBtn, { backgroundColor: template.accent }]}>
              <Typography variant="caption" color="#FFFFFF" style={styles.roleBtnText}>Open Flow</Typography>
              <ArrowRight color="#FFFFFF" size={14} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.78} onPress={() => onOption('__role_cancel__')} style={[styles.roleGhostBtn, { borderColor: appTheme.border }]}>
              <Typography variant="caption" color={appTheme.muted} style={styles.roleBtnText}>Cancel</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {card.stage === 'summary' ? (
        <View style={[styles.roleSummaryBlock, { borderTopColor: appTheme.borderSoft }]}>
          <View style={styles.roleSummaryRows}>
            {templateWizardInputs(template)
              .filter((input) => input.target !== 'gate')
              .filter((input) => answers[input.key] || input.target === 'node')
              .slice(0, 6)
              .map((input) => {
                const value = answers[input.key] || input.suggestion || (input.target === 'node' ? 'Mr LAD writes this at send time.' : '');
                return (
                  <View key={input.key} style={[styles.roleSummaryRow, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
                    <Typography variant="overline" color={appTheme.disabled} style={styles.roleSummaryLabel} numberOfLines={1}>
                      {input.label || input.key.replace(/_/g, ' ')}
                    </Typography>
                    <Typography variant="caption" color={appTheme.text} style={styles.roleSummaryValue} numberOfLines={3}>
                      {value}
                    </Typography>
                  </View>
                );
              })}
            {!Object.keys(answers).length && !templateWizardInputs(template).some((input) => input.target === 'node') ? (
              <Typography variant="caption" color={appTheme.muted} style={styles.roleSummaryCopy}>
                Nothing else to configure. This Accelerator is ready to review or launch.
              </Typography>
            ) : null}
          </View>
          <View style={styles.roleDefaultsRow}>
            <Clock color={appTheme.disabled} size={12} />
            <Typography variant="caption" color={appTheme.disabled} style={styles.roleHint}>
              Defaults: 25 leads/day, 30 days. You can adjust this in Flow.
            </Typography>
          </View>
          <View style={styles.roleCtaWrap}>
            {previewQuery ? (
              <TouchableOpacity
                activeOpacity={0.78}
                disabled={previewing}
                onPress={() => onOption('__role_preview__')}
                style={[styles.roleGhostBtn, styles.roleCtaBtn, { borderColor: `${template.accent}55`, backgroundColor: `${template.accent}0F` }, previewing && styles.disabled]}
              >
                {previewing ? <ActivityIndicator color={template.accent} size="small" /> : <Search color={template.accent} size={14} />}
                <Typography variant="caption" color={template.accent} style={styles.roleBtnText}>
                  {previewing ? 'Searching' : 'Preview leads'}
                </Typography>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity activeOpacity={0.82} onPress={() => onOption('__role_launch__')} style={[styles.rolePrimaryBtn, styles.roleCtaBtn, { backgroundColor: template.accent }]}>
              <Rocket color="#FFFFFF" size={14} />
              <Typography variant="caption" color="#FFFFFF" style={styles.roleBtnText}>Activate & launch</Typography>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.78} onPress={() => onOption('__role_review__')} style={[styles.roleGhostBtn, styles.roleCtaBtn, { borderColor: appTheme.border }]}>
              <Typography variant="caption" color={appTheme.text} style={styles.roleBtnText}>Review in Flow</Typography>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.78} onPress={() => onOption('__role_cancel__')} style={styles.roleCancelBtn}>
              <Typography variant="caption" color={appTheme.disabled} style={styles.roleBtnText}>Cancel</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  roleCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  roleCardAccent: {
    height: 3,
    width: '100%',
    flexDirection: 'row',
  },
  roleCardAccentStrong: {
    flex: 5,
  },
  roleCardAccentSoft: {
    flex: 1,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
  },
  roleTitle: {
    fontWeight: '700',
    flexShrink: 1,
    letterSpacing: 0,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0,
  },
  roleTagline: {
    lineHeight: 16,
  },
  roleChainWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  acceleratorChain: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 5,
    columnGap: 4,
  },
  acceleratorChainChip: {
    maxWidth: 132,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  acceleratorChainText: {
    fontWeight: '600',
    fontSize: 10.5,
    letterSpacing: 0,
    textTransform: 'none',
  },
  acceleratorMoreText: {
    fontWeight: '600',
    fontSize: 9.5,
    letterSpacing: 0,
    textTransform: 'none',
  },
  roleQuestionBlock: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
  },
  roleProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleProgressText: {
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0,
  },
  roleProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  roleProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  roleNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleNudge: {
    fontWeight: '700',
  },
  roleQuestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 0,
    shadowColor: '#0B1957',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 2,
  },
  roleQuestionMark: {
    marginTop: 1,
  },
  roleQuestionText: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 21,
  },
  roleButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  rolePrimaryBtn: {
    minHeight: 36,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roleGhostBtn: {
    minHeight: 36,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roleBtnText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  roleSuggestionBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 4,
  },
  roleSuggestionLabel: {
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0,
  },
  roleSuggestionText: {
    lineHeight: 17,
  },
  roleHint: {
    lineHeight: 16,
    flexShrink: 1,
  },
  roleSummaryBlock: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 10,
  },
  roleSummaryRows: {
    gap: 7,
  },
  roleSummaryRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  roleSummaryLabel: {
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  roleSummaryValue: {
    fontWeight: '600',
    lineHeight: 17,
  },
  roleSummaryCopy: {
    lineHeight: 19,
  },
  roleDefaultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleCtaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleCtaBtn: {
    flexGrow: 1,
    minWidth: 132,
  },
  roleCancelBtn: {
    minHeight: 36,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
});
