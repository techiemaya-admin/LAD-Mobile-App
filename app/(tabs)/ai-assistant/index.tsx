import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Building2, Check, ChevronDown, ExternalLink, History, ImageIcon, Mail, MessageSquare, Plus, RefreshCw, Search, Send, Sparkles, Star, UserPlus, UserRound, UsersRound, Zap } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Theme from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Typography } from '@/components/ui/Typography';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useAdvancedSearch } from '@/src/hooks/useAdvancedSearch';
import { AssistantChatMessage, MobileAssistantLead } from '@/src/services/mobileAIAssistantService';
import { runProspectSearch } from '@/src/services/prospectsService';
import type { SearchBackendRollup, SearchRunResult } from '@/src/services/prospectsService';
import { useAppTheme } from '@/src/theme/appTheme';

const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;
const MAX_RESULTS_OPTIONS = [5, 25, 50, 100, 250, 500];
const ICP_LEADS_PROMPT = 'Get leads from my active ICP';
const PLACEHOLDER_SUGGESTIONS = [
  'Connect me with founders in trading companies in UAE',
  'Connect me with CFO in Goldman Sachs in USA',
  'Schedule sales meetings with procurement managers in HVAC in UAE',
  'Find VP of Sales in SaaS companies in UK',
  'Reach out to HR directors in manufacturing in Germany',
  'Strengthen my relationship with existing clients',
];
const LANDING_SUGGESTIONS = [
  { label: 'Founders in trading in UAE', value: 'Connect me with founders in trading companies in UAE', icon: 'search' },
  { label: 'Sales meetings with HVAC managers', value: 'Schedule sales meetings with procurement managers in HVAC in UAE', icon: 'building' },
  { label: 'VP of Sales in UK SaaS', value: 'Find VP of Sales in SaaS companies in UK', icon: 'people' },
  { label: 'Strengthen client relationships', value: 'Strengthen my relationship with existing clients', icon: 'relationship' },
  { label: ICP_LEADS_PROMPT, value: ICP_LEADS_PROMPT, icon: 'spark' },
  { label: 'Media Generation', value: 'Help me create media for an outreach campaign', icon: 'image' },
];
const LANDING_BACKGROUND = '#FBFCFF';
const LANDING_SOFT = '#F6F8FF';
const LANDING_BORDER = '#AFC2FF';

const scoreTone = (score?: number) => {
  if ((score ?? 0) >= 70) return { bg: '#DCFCE7', fg: '#166534', label: 'Strong' };
  if ((score ?? 0) >= 45) return { bg: '#FEF9C3', fg: '#854D0E', label: 'Moderate' };
  return { bg: '#E0E7FF', fg: '#3730A3', label: 'Match' };
};

const LADMark = ({ size = 32, color = '#0B1957' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="50 120 110 130">
    <Path
      fill={color}
      fillRule="evenodd"
      d="M90.605 187.719c-13.835-4.52-27.66 7.976-24.097 22.394 4.594 17.77 23.656 26.117 42.418 25.469v-12.828c-31.363.25-42.027-33.168-18.32-35.035Zm5.2 9.379a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058Zm10.734 0a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058Zm10.73 0a3.029 3.029 0 1 0 0 6.058 3.029 3.029 0 0 0 0-6.058ZM98.324 160.398c-14.512-4.254-33.902-13.273-39.133-28.687-1.629 5.144-2.117 10.398-1.593 15.48.383 3.735 1.02 6.989 1.87 9.833 2.571 6.68 7.126 12.62 13.356 16.882-.629-3.601-.172-7.308 1.309-10.648 8.472 10.969 37.125 14.453 50.476 23.406 5.45 3.656 8.785 9.816 8.785 16.477 0 12.058-16.421 23.84-24.168 32.433 17.418-.691 34.508-9.14 39.461-25.011 13.723-44.004-53.984-49.23-76.855-80.922 1.023 15.945 12.512 24.859 26.492 30.757Z"
    />
  </Svg>
);

const LandingSuggestionIcon = ({ icon, color }: { icon: string; color: string }) => {
  switch (icon) {
    case 'building':
      return <Building2 color={color} size={15} />;
    case 'people':
      return <UsersRound color={color} size={15} />;
    case 'relationship':
      return <UserPlus color={color} size={15} />;
    case 'spark':
      return <Sparkles color={color} size={15} />;
    case 'image':
      return <ImageIcon color={color} size={15} />;
    default:
      return <Search color={color} size={15} />;
  }
};

export default function AIAssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const { width } = useWindowDimensions();
  const assistant = useAdvancedSearch();
  const listRef = useRef<FlatList<AssistantChatMessage>>(null);
  const landingInputRef = useRef<TextInput>(null);
  const [showLeadResults, setShowLeadResults] = useState(true);
  const [activePanel, setActivePanel] = useState<'chat' | 'leads' | 'flow'>('chat');
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showLandingMenu, setShowLandingMenu] = useState(false);
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const isCompact = width < 520;
  const horizontalPadding = isCompact ? Theme.spacing.md : Theme.spacing.xl;
  const contentMaxWidth = width >= 900 ? 860 : undefined;
  const hasLeads = assistant.leads.length > 0;
  const hasUsefulContext = showDiscovery || hasLeads || Boolean(assistant.lastSearchQuery) || assistant.outreachJourney.length > 0;
  const landingContentWidth = Math.min(Math.max(width - horizontalPadding * 2, 300), 640);

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [assistant.messages.length, assistant.isBusy, assistant.isSearching]);

  useEffect(() => {
    if (!showLanding || assistant.input.trim()) {
      setTypedPlaceholder('');
      return undefined;
    }

    let suggestionIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = PLACEHOLDER_SUGGESTIONS[suggestionIndex];
      if (!deleting) {
        charIndex += 1;
        setTypedPlaceholder(current.slice(0, charIndex));
        if (charIndex === current.length) {
          deleting = true;
          timer = setTimeout(tick, 1600);
          return;
        }
        timer = setTimeout(tick, 48);
        return;
      }

      charIndex -= 1;
      setTypedPlaceholder(current.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        suggestionIndex = (suggestionIndex + 1) % PLACEHOLDER_SUGGESTIONS.length;
        timer = setTimeout(tick, 360);
        return;
      }
      timer = setTimeout(tick, 24);
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [assistant.input, showLanding]);

  useEffect(() => {
    if (!hasLeads && activePanel !== 'chat') {
      setActivePanel('chat');
    }
  }, [activePanel, hasLeads]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const handleReset = () => {
    assistant.resetConversation();
    setActivePanel('chat');
    setShowDiscovery(false);
    setShowLanding(true);
    setShowLandingMenu(false);
  };

  const openActiveIcpDiscovery = () => {
    assistant.setInput('');
    setActivePanel('chat');
    setShowLanding(false);
    setShowLandingMenu(false);
    setShowDiscovery(true);
  };

  const handleLandingSubmit = async (value?: string) => {
    const text = (value ?? assistant.input).trim();
    if (!text || assistant.isBusy || assistant.isSearching) return;

    if (text === ICP_LEADS_PROMPT) {
      openActiveIcpDiscovery();
      return;
    }

    setActivePanel('chat');
    setShowDiscovery(false);
    setShowLanding(false);
    setShowLandingMenu(false);
    await assistant.submitMessage(text);
  };

  const handleLandingSuggestion = (value: string) => {
    assistant.setInput(value);
    requestAnimationFrame(() => landingInputRef.current?.focus());
  };

  const openUrl = (url?: string) => {
    if (!url) return;
    void Linking.openURL(url).catch(() => undefined);
  };

  const openOutreachSetup = () => {
    assistant.startOutreachWorkflow();
    setActivePanel('flow');
  };

  const launchOutreachJourney = () => {
    if (assistant.outreachWorkflowStage === 'idle') {
      assistant.startOutreachWorkflow();
    }
    void assistant.launchOutreachCampaign();
  };

  const renderLeadCard = (lead: MobileAssistantLead) => {
    const tone = scoreTone(lead.score);
    return (
      <GlassCard key={lead.id} style={[styles.leadCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
        <View style={styles.leadTop}>
          <View style={[styles.avatar, { backgroundColor: appTheme.infoSoft }]}>
            <UserRound color={appTheme.primaryAccent} size={18} />
          </View>
          <View style={styles.leadTitleBlock}>
            <Typography variant="body" color={appTheme.text} style={styles.leadName} numberOfLines={1}>
              {lead.name}
            </Typography>
            <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
              {lead.headline || lead.company || lead.location || 'Prospect'}
            </Typography>
          </View>
          {lead.score != null ? (
            <View style={[styles.scorePill, { backgroundColor: tone.bg }]}>
              <Typography variant="caption" color={tone.fg} style={styles.scoreText}>{tone.label} {lead.score}%</Typography>
            </View>
          ) : null}
        </View>

        <View style={styles.leadMeta}>
          {lead.company ? (
            <View style={styles.metaItem}>
              <Building2 color={appTheme.muted} size={14} />
              <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.company}</Typography>
            </View>
          ) : null}
          {lead.location ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.location}</Typography> : null}
          {lead.industry ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.industry}</Typography> : null}
        </View>

        {lead.reasoning ? (
          <Typography variant="bodySmall" color={appTheme.muted} style={styles.reasoning} numberOfLines={3}>
            {lead.reasoning}
          </Typography>
        ) : null}

        <View style={styles.leadActions}>
          {lead.profileUrl ? (
            <TouchableOpacity style={[styles.smallAction, { borderColor: appTheme.border }]} onPress={() => openUrl(lead.profileUrl)}>
              <ExternalLink color={appTheme.primaryAccent} size={14} />
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.actionText}>LinkedIn</Typography>
            </TouchableOpacity>
          ) : null}
          {lead.email ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.email}</Typography> : null}
          {lead.phone ? <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>{lead.phone}</Typography> : null}
        </View>
      </GlassCard>
    );
  };

  const renderMessage = ({ item }: { item: AssistantChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        {!isUser ? (
          <View style={[styles.botDot, { backgroundColor: appTheme.infoSoft }]}>
            <LADMark color={appTheme.primaryAccent} size={20} />
          </View>
        ) : null}
        <View style={[
          styles.bubble,
          {
            backgroundColor: isUser ? appTheme.primaryAccent : appTheme.surface,
            borderColor: isUser ? appTheme.primaryAccent : appTheme.border,
          },
        ]}>
          {isUser ? (
            <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.messageText}>
              {item.text}
            </Typography>
          ) : (
            <MarkdownText text={item.text} textColor={appTheme.text} />
          )}
          {item.options?.length ? (
            <View style={styles.optionWrap}>
              {item.options.map((option) => (
                <TouchableOpacity
                  key={`${item.id}-${option.value}`}
                  activeOpacity={0.78}
                  onPress={() => void assistant.chooseOption(option.value)}
                  style={[styles.optionChip, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}
                >
                  <Typography variant="caption" color={appTheme.text} style={styles.optionText}>{option.label}</Typography>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {item.leads?.length ? (
            <View style={styles.inlineLeads}>
              {item.leads.slice(0, 3).map(renderLeadCard)}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  // Markdown text renderer: handles **bold**, bullet lines, and line breaks
  const MarkdownText = ({ text, textColor }: { text: string; textColor: string }) => {
    const lines = text.split('\n');
    return (
      <View style={{ gap: 3 }}>
        {lines.map((line, lineIndex) => {
          const trimmed = line.trim();
          const isBullet = /^[-•*]\s+/.test(trimmed);
          const content = isBullet ? trimmed.replace(/^[-•*]\s+/, '') : line;

          // Split line into bold/normal segments
          const segments: { text: string; bold: boolean }[] = [];
          const boldRegex = /\*\*(.+?)\*\*/g;
          let lastIndex = 0;
          let match;
          while ((match = boldRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
              segments.push({ text: content.slice(lastIndex, match.index), bold: false });
            }
            segments.push({ text: match[1], bold: true });
            lastIndex = match.index + match[0].length;
          }
          if (lastIndex < content.length) {
            segments.push({ text: content.slice(lastIndex), bold: false });
          }
          if (segments.length === 0) segments.push({ text: content, bold: false });

          if (!trimmed) {
            return <View key={lineIndex} style={{ height: 4 }} />;
          }

          return (
            <View key={lineIndex} style={isBullet ? { flexDirection: 'row', alignItems: 'flex-start', gap: 6 } : undefined}>
              {isBullet && (
                <Typography variant="bodySmall" color={textColor} style={{ lineHeight: 20, marginTop: 1 }}>{'•'}</Typography>
              )}
              <Typography variant="bodySmall" color={textColor} style={[styles.messageText, { flexShrink: 1, lineHeight: 20 }]}>
                {segments.map((seg, segIndex) => (
                  <Typography
                    key={segIndex}
                    variant="bodySmall"
                    color={textColor}
                    style={seg.bold ? { fontWeight: '700', lineHeight: 20 } : { lineHeight: 20 }}
                  >
                    {seg.text}
                  </Typography>
                ))}
              </Typography>
            </View>
          );
        })}
      </View>
    );
  };

  const renderOutreachStatusCard = () => {
    if (assistant.outreachWorkflowStage === 'idle') return null;

    const selectedChannels = assistant.selectedOutreachChannels.length
      ? assistant.selectedOutreachChannels
      : ['linkedin', 'email', 'whatsapp', 'voice'];
    const hasLaunchError = Boolean(assistant.error && assistant.outreachWorkflowStage !== 'launching' && assistant.outreachWorkflowStage !== 'launched');
    const statusTitle = assistant.outreachWorkflowStage === 'launching'
      ? 'Creating outreach journey'
      : assistant.outreachWorkflowStage === 'launched'
        ? 'Outreach journey created'
        : hasLaunchError
          ? 'Outreach journey not created'
          : 'Outreach journey ready';
    const statusBody = assistant.outreachWorkflowStage === 'launching'
      ? 'Preparing the campaign, leads, channels, and workflow steps.'
      : assistant.outreachWorkflowStage === 'launched'
        ? assistant.launchedCampaignId
          ? `Campaign ID ${assistant.launchedCampaignId} is now available in Campaigns.`
          : 'The journey is ready. You can monitor it from Campaigns.'
        : hasLaunchError
          ? assistant.error
          : `${assistant.leads.length} lead${assistant.leads.length === 1 ? '' : 's'} - ${selectedChannels.join(', ')} - ${assistant.campaignDays || 30} days`;

    return (
      <GlassCard
        style={[
          styles.launchStatusCard,
          {
            backgroundColor: hasLaunchError ? '#FFF7ED' : appTheme.surface,
            borderColor: hasLaunchError ? '#FDBA74' : appTheme.border,
          },
        ]}
      >
        <View style={styles.launchStatusHeader}>
          <View style={[styles.launchStatusIcon, { backgroundColor: hasLaunchError ? '#FED7AA' : appTheme.infoSoft }]}>
            {assistant.outreachWorkflowStage === 'launching' ? (
              <ActivityIndicator color={appTheme.primaryAccent} size="small" />
            ) : assistant.outreachWorkflowStage === 'launched' ? (
              <Check color={appTheme.primaryAccent} size={16} />
            ) : (
              <Zap color={hasLaunchError ? '#EA580C' : appTheme.primaryAccent} size={16} />
            )}
          </View>
          <View style={styles.launchStatusCopy}>
            <Typography variant="bodySmall" color={hasLaunchError ? '#9A3412' : appTheme.text} style={styles.launchStatusTitle}>
              {statusTitle}
            </Typography>
            <Typography variant="caption" color={hasLaunchError ? '#C2410C' : appTheme.muted} style={styles.launchStatusText}>
              {statusBody}
            </Typography>
          </View>
        </View>
      </GlassCard>
    );
  };

  const renderResultActions = () => {
    if (!hasLeads) return null;
    const shouldLaunch = activePanel === 'flow';
    const isLaunching = assistant.outreachWorkflowStage === 'launching';
    const isLaunched = assistant.outreachWorkflowStage === 'launched';
    const primaryLabel = isLaunched && shouldLaunch
      ? 'Journey Created'
      : shouldLaunch
        ? 'Launch Journey'
        : 'Create Outreach Journey';

    return (
      <View style={[styles.resultActionBar, { borderTopColor: appTheme.borderSoft }]}>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => {
            setActivePanel('chat');
            assistant.refineTargeting();
          }}
          style={[styles.refineBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
        >
          <Typography variant="caption" color={appTheme.text} style={styles.refineText}>Refine</Typography>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={shouldLaunch ? launchOutreachJourney : openOutreachSetup}
          disabled={isLaunching || (isLaunched && shouldLaunch)}
          style={[styles.journeyBtn, { backgroundColor: appTheme.primaryAccent }, (isLaunching || (isLaunched && shouldLaunch)) && styles.disabled]}
        >
          {isLaunching ? (
            <ActivityIndicator color={Theme.colors.surface} size="small" />
          ) : (
            <Typography variant="caption" color={Theme.colors.surface} style={styles.journeyText}>{primaryLabel}</Typography>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderLeadsPanel = () => (
    <ScrollView
      style={styles.panelPage}
      contentContainerStyle={[
        styles.panelPageContent,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom + 104, 132),
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomTabScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.panelTitleRow}>
        <View style={styles.panelTitleCopy}>
          <Typography variant="h3" color={appTheme.text}>Leads</Typography>
          <Typography variant="caption" color={appTheme.muted}>
            {assistant.totalResults || assistant.leads.length} real lead{(assistant.totalResults || assistant.leads.length) === 1 ? '' : 's'} from the assistant search
          </Typography>
        </View>
        <TouchableOpacity
          activeOpacity={0.76}
          onPress={() => void assistant.loadMore()}
          disabled={assistant.isLoadingMore}
          style={[styles.compactLoadBtn, { backgroundColor: appTheme.primaryAccent }]}
        >
          {assistant.isLoadingMore ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : <Typography variant="caption" color={Theme.colors.surface} style={styles.loadMoreText}>More</Typography>}
        </TouchableOpacity>
      </View>
      {assistant.leads.map(renderLeadCard)}
      {renderResultActions()}
    </ScrollView>
  );

  const renderFlowPanel = () => (
    <ScrollView
      style={styles.panelPage}
      contentContainerStyle={[
        styles.panelPageContent,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom + 104, 132),
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}
      showsVerticalScrollIndicator={false}
      onScroll={handleBottomTabScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.panelTitleRow}>
        <View style={styles.panelTitleCopy}>
          <Typography variant="h3" color={appTheme.text}>Flow</Typography>
          <Typography variant="caption" color={appTheme.muted}>Suggested outreach journey</Typography>
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={launchOutreachJourney}
          style={[styles.compactLoadBtn, { backgroundColor: appTheme.primaryAccent }]}
          disabled={assistant.outreachWorkflowStage === 'launching' || assistant.outreachWorkflowStage === 'launched'}
        >
          {assistant.outreachWorkflowStage === 'launching' ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : <Typography variant="caption" color={Theme.colors.surface} style={styles.loadMoreText}>{assistant.outreachWorkflowStage === 'launched' ? 'Created' : 'Launch'}</Typography>}
        </TouchableOpacity>
      </View>

      {assistant.outreachJourney.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flowStepper}>
          {assistant.outreachJourney.map((step, index) => (
            <TouchableOpacity
              key={`${step.channel}-${index}`}
              activeOpacity={0.78}
              onPress={() => {
                assistant.startOutreachWorkflow();
                assistant.toggleOutreachChannel(step.channel);
              }}
              style={styles.flowStepWrap}
            >
              <View style={[styles.flowCircle, { backgroundColor: getJourneyColor(step.channel) }]}>
                {getJourneyIcon(step.channel, Theme.colors.surface)}
              </View>
              <Typography variant="caption" color={appTheme.text} style={styles.flowStepTitle}>{step.channel}</Typography>
              <Typography variant="caption" color={appTheme.muted} style={styles.flowStepAction}>{step.action}</Typography>
              {step.recommended ? (
                <View style={styles.recommendedPill}>
                  <Typography variant="overline" color={Theme.colors.info} style={styles.recommendedText}>Recommended</Typography>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.panel}>
        <Typography variant="body" color={appTheme.text} style={styles.panelTitle}>Campaign setup</Typography>
        <Typography variant="caption" color={appTheme.muted}>
          {assistant.campaignName || 'AI Growth Campaign'} - {assistant.campaignDays || 30} days
        </Typography>
        <View style={styles.channelGrid}>
          {['linkedin', 'email', 'whatsapp', 'voice'].map((channel) => {
            const selected = assistant.selectedOutreachChannels.length
              ? assistant.selectedOutreachChannels.includes(channel)
              : ['linkedin', 'email', 'whatsapp', 'voice'].includes(channel);
            return (
              <TouchableOpacity
                key={channel}
                activeOpacity={0.78}
                onPress={() => assistant.toggleOutreachChannel(channel)}
                style={[
                  styles.channelChip,
                  {
                    backgroundColor: selected ? appTheme.primaryAccent : appTheme.surface,
                    borderColor: selected ? appTheme.primaryAccent : appTheme.border,
                  },
                ]}
              >
                {selected ? <Check color={Theme.colors.surface} size={14} /> : null}
                <Typography variant="caption" color={selected ? Theme.colors.surface : appTheme.text} style={styles.channelChipText}>
                  {channel === 'voice' ? 'Voice' : channel.charAt(0).toUpperCase() + channel.slice(1)}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {renderOutreachStatusCard()}

      {renderResultActions()}
    </ScrollView>
  );

  const renderMobilePanelNav = () => {
    if (!hasLeads) return null;
    const items = [
      { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
      { id: 'leads' as const, label: 'Leads', icon: UsersRound },
      { id: 'flow' as const, label: 'Flow', icon: Zap },
    ];

    return (
      <View style={[styles.bottomPanelNavWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={[styles.bottomPanelNav, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
          {items.map((item) => {
            const selected = activePanel === item.id;
            const Icon = item.icon;
            return (
              <TouchableOpacity key={item.id} activeOpacity={0.78} onPress={() => setActivePanel(item.id)} style={styles.panelNavItem}>
                <View style={[styles.panelNavIcon, selected && { backgroundColor: appTheme.infoSoft }]}>
                  <Icon color={selected ? appTheme.primaryAccent : appTheme.muted} size={20} />
                </View>
                <Typography variant="overline" color={selected ? appTheme.primaryAccent : appTheme.disabled} style={styles.panelNavLabel}>
                  {item.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (showLanding) {
    const landingChipWidth = width < 360 ? '100%' : '48%';
    const canSendLanding = Boolean(assistant.input.trim()) && !assistant.isBusy && !assistant.isSearching;

    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: LANDING_BACKGROUND }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleBottomTabScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.landingContent,
            {
              paddingTop: insets.top + Theme.spacing.lg,
              paddingBottom: Math.max(insets.bottom + 32, Theme.spacing.xxl),
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          <View style={[styles.landingTopBar, { width: landingContentWidth }]}>
            <TouchableOpacity onPress={handleBack} style={[styles.landingBackBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} activeOpacity={0.76}>
              <ArrowLeft color={appTheme.text} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openActiveIcpDiscovery}
              style={[styles.landingMagicBtn, { backgroundColor: appTheme.primaryAccent }]}
              activeOpacity={0.82}
            >
              <Sparkles color={Theme.colors.surface} size={25} />
            </TouchableOpacity>
          </View>

          <View style={[styles.landingHero, { width: landingContentWidth }]}>
            <View style={styles.landingLogoWrap}>
              <LADMark color={appTheme.primaryAccent} size={64} />
            </View>
            <Typography variant={isCompact ? 'h4' : 'h3'} color={appTheme.text} style={styles.landingTitle} numberOfLines={2}>
              Hey! I am LAD, How can I help you today?
            </Typography>
            <View style={styles.landingSparkleGhost}>
              <Sparkles color="#C9D8FF" size={30} />
            </View>
          </View>

          <View style={[styles.landingInputOuter, { width: landingContentWidth, borderColor: appTheme.primaryAccent, backgroundColor: appTheme.surface }]}>
            <TextInput
              ref={landingInputRef}
              style={[styles.landingInput, WEB_INPUT_RESET, { color: appTheme.text }]}
              placeholder={typedPlaceholder || 'Ask LAD to find leads, research accounts, or build outreach...'}
              placeholderTextColor={appTheme.primaryAccent}
              value={assistant.input}
              onChangeText={assistant.setInput}
              editable={!assistant.isBusy && !assistant.isSearching}
              multiline
              blurOnSubmit
              returnKeyType="send"
              onSubmitEditing={() => void handleLandingSubmit()}
            />
            <View style={styles.landingInputFooter}>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => setShowLandingMenu((value) => !value)}
                style={[styles.landingCircleBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
              >
                <Plus color={appTheme.primaryAccent} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={assistant.toggleSalesNav}
                style={[
                  styles.landingPremiumChip,
                  {
                    backgroundColor: assistant.useSalesNav ? appTheme.primaryAccent : appTheme.softSurface,
                    borderColor: assistant.useSalesNav ? appTheme.primaryAccent : appTheme.border,
                  },
                ]}
              >
                <Star color={assistant.useSalesNav ? Theme.colors.surface : appTheme.primaryAccent} size={12} />
                <Typography variant="caption" color={assistant.useSalesNav ? Theme.colors.surface : appTheme.muted} style={styles.landingPremiumText}>
                  {assistant.useSalesNav ? 'Premium Search ON' : 'Premium Search'}
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.82}
                disabled={!canSendLanding}
                onPress={() => void handleLandingSubmit()}
                style={[styles.landingSendBtn, { backgroundColor: canSendLanding ? appTheme.primaryAccent : appTheme.border }]}
              >
                {assistant.isBusy || assistant.isSearching ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : <Send color={Theme.colors.surface} size={18} />}
              </TouchableOpacity>
            </View>
            {showLandingMenu ? (
              <View style={[styles.landingToolMenu, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                <TouchableOpacity activeOpacity={0.78} style={styles.landingToolItem} onPress={openActiveIcpDiscovery}>
                  <Sparkles color={appTheme.primaryAccent} size={16} />
                  <View style={styles.landingToolCopy}>
                    <Typography variant="caption" color={appTheme.text} style={styles.landingToolTitle}>Use active ICP</Typography>
                    <Typography variant="overline" color={appTheme.muted}>Run prospect discovery</Typography>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.78} style={styles.landingToolItem} onPress={() => handleLandingSuggestion('Research a company')}>
                  <Search color={appTheme.primaryAccent} size={16} />
                  <View style={styles.landingToolCopy}>
                    <Typography variant="caption" color={appTheme.text} style={styles.landingToolTitle}>Research account</Typography>
                    <Typography variant="overline" color={appTheme.muted}>Company insight prompt</Typography>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={[styles.landingSuggestions, { width: landingContentWidth }]}>
            {LANDING_SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.label}
                activeOpacity={0.78}
                onPress={() => handleLandingSuggestion(suggestion.value)}
                style={[styles.landingSuggestionChip, { width: landingChipWidth, borderColor: LANDING_BORDER, backgroundColor: appTheme.surface }]}
              >
                <View style={styles.landingSuggestionIcon}>
                  <LandingSuggestionIcon icon={suggestion.icon} color={appTheme.primaryAccent} />
                </View>
                <Typography variant="caption" color={appTheme.text} style={styles.landingSuggestionText}>
                  {suggestion.label}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: appTheme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingHorizontal: horizontalPadding, backgroundColor: appTheme.surface, borderBottomColor: appTheme.border }]}>
        <TouchableOpacity onPress={handleBack} style={[styles.iconBtn, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]} activeOpacity={0.76}>
          <ArrowLeft color={appTheme.text} size={21} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Typography variant={isCompact ? 'h4' : 'h3'} color={appTheme.text} numberOfLines={1}>AI Assistant</Typography>
          <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
            Lead discovery and outreach assistant
          </Typography>
        </View>
        <TouchableOpacity onPress={handleReset} style={[styles.iconBtn, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]} activeOpacity={0.76}>
          <RefreshCw color={appTheme.muted} size={19} />
        </TouchableOpacity>
      </View>

      {hasUsefulContext ? (
      <View style={[styles.contextBand, { paddingHorizontal: horizontalPadding, backgroundColor: appTheme.surface, borderBottomColor: appTheme.borderSoft }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.contextScroll, { maxWidth: contentMaxWidth }]}>
          {assistant.lastSearchQuery ? (
            <View style={[styles.contextChip, { backgroundColor: appTheme.successSoft }]}>
              <Search color={Theme.colors.success} size={15} />
              <Typography variant="caption" color={appTheme.text} style={styles.contextText} numberOfLines={1}>
                {assistant.lastModuleUsed ? assistant.lastModuleUsed.replace(/_/g, ' ') : 'Unified search'}
              </Typography>
            </View>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => {
              setActivePanel('chat');
              setShowDiscovery((current) => !current);
            }}
            style={[styles.contextChip, { backgroundColor: showDiscovery ? appTheme.primaryAccent : appTheme.softSurface }]}
          >
            <Sparkles color={showDiscovery ? Theme.colors.surface : appTheme.primaryAccent} size={15} />
            <Typography variant="caption" color={showDiscovery ? Theme.colors.surface : appTheme.text} style={styles.contextText}>
              Discover prospects
            </Typography>
          </TouchableOpacity>
          {hasLeads ? (
            <View style={[styles.contextChip, { backgroundColor: appTheme.warningSoft }]}>
              <Zap color={Theme.colors.warning} size={15} />
              <Typography variant="caption" color={appTheme.text} style={styles.contextText}>
                {assistant.totalResults || assistant.leads.length} leads
              </Typography>
            </View>
          ) : null}
        </ScrollView>
      </View>
      ) : null}

      {activePanel === 'chat' ? (
      <FlatList
        ref={listRef}
        data={assistant.messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.messagesContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: hasLeads ? Math.max(insets.bottom + 116, 148) : Theme.spacing.xl,
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            {showDiscovery ? (
              <ProspectDiscoveryPanel onComplete={() => undefined} />
            ) : null}
            {assistant.recentSearches.length ? (
              <View style={styles.recentBlock}>
                <View style={styles.recentTitle}>
                  <History color={appTheme.muted} size={15} />
                  <Typography variant="caption" color={appTheme.muted} style={styles.contextText}>Recent searches</Typography>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroller}>
                  {assistant.recentSearches.map((item) => (
                    <TouchableOpacity key={item} style={[styles.recentChip, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => void assistant.submitMessage(item)}>
                      <Typography variant="caption" color={appTheme.text} numberOfLines={1}>{item}</Typography>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {assistant.isBusy || assistant.isSearching ? (
              <GlassCard style={[styles.thinkingCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                <ActivityIndicator color={appTheme.primaryAccent} size="small" />
                <Typography variant="caption" color={appTheme.muted}>
                  {assistant.isSearching ? 'Searching LAD for the best matches...' : 'Assistant is thinking...'}
                </Typography>
              </GlassCard>
            ) : null}

            {assistant.leads.length ? (
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Typography variant="body" color={appTheme.text} style={styles.panelTitle}>Mobile lead results</Typography>
                  <TouchableOpacity
                    activeOpacity={0.76}
                    onPress={() => setShowLeadResults((value) => !value)}
                    style={[styles.resultsToggle, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
                  >
                    <Typography variant="caption" color={appTheme.muted} style={styles.resultsCount}>
                      {assistant.totalResults || assistant.leads.length} total
                    </Typography>
                    <ChevronDown
                      color={appTheme.muted}
                      size={18}
                      style={!showLeadResults ? undefined : styles.resultsChevronOpen}
                    />
                  </TouchableOpacity>
                </View>
                {showLeadResults ? (
                  <>
                    {assistant.leads.map(renderLeadCard)}
                    <TouchableOpacity
                      style={[styles.loadMoreBtn, { backgroundColor: appTheme.primaryAccent }]}
                      disabled={assistant.isLoadingMore}
                      onPress={() => void assistant.loadMore()}
                    >
                      {assistant.isLoadingMore ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : <Typography variant="bodySmall" color={Theme.colors.surface} style={styles.loadMoreText}>Get More Leads</Typography>}
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            ) : null}

            {assistant.outreachJourney.length ? (
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Typography variant="body" color={appTheme.text} style={styles.panelTitle}>Suggested outreach journey</Typography>
                  <TouchableOpacity
                    activeOpacity={0.78}
                    onPress={openOutreachSetup}
                    style={[styles.createJourneyBtn, { backgroundColor: appTheme.primaryAccent }]}
                    disabled={assistant.outreachWorkflowStage === 'launching'}
                  >
                    {assistant.outreachWorkflowStage === 'launching' ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : (
                      <Typography variant="caption" color={Theme.colors.surface} style={styles.createJourneyText}>
                        Create
                      </Typography>
                    )}
                  </TouchableOpacity>
                </View>
                {assistant.outreachJourney.map((step) => (
                  <TouchableOpacity
                    key={step.channel}
                    activeOpacity={0.78}
                    onPress={() => {
                      assistant.startOutreachWorkflow();
                      assistant.toggleOutreachChannel(step.channel);
                    }}
                  >
                    <GlassCard style={[styles.journeyCard, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
                      <Typography variant="bodySmall" color={appTheme.text} style={styles.journeyTitle}>{step.channel}</Typography>
                      <Typography variant="caption" color={appTheme.muted}>{step.action}</Typography>
                    </GlassCard>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {assistant.error ? (
              <Typography variant="caption" color={Theme.colors.warning} style={styles.errorText}>{assistant.error}</Typography>
            ) : null}
            {renderResultActions()}
          </View>
        }
      />
      ) : activePanel === 'leads' ? renderLeadsPanel() : renderFlowPanel()}

      {activePanel === 'chat' ? (
      <View
        style={[
          styles.inputArea,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: hasLeads ? Math.max(insets.bottom + 84, 92) : Math.max(insets.bottom + 8, Theme.spacing.md),
            backgroundColor: appTheme.surface,
            borderTopColor: appTheme.border,
          },
        ]}
      >
        <GlassCard style={[styles.inputCard, { maxWidth: contentMaxWidth, backgroundColor: appTheme.input, borderColor: appTheme.border }]}>
          <TextInput
            style={[styles.input, WEB_INPUT_RESET, { color: appTheme.text }]}
            placeholder="Ask for leads, company insights, or outreach workflow..."
            placeholderTextColor={appTheme.disabled}
            value={assistant.input}
            onChangeText={assistant.setInput}
            multiline
            editable={!assistant.isBusy && !assistant.isSearching}
            onSubmitEditing={() => {
              if (Platform.OS !== 'web') void assistant.submitMessage();
            }}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: appTheme.primaryAccent }, (!assistant.input.trim() || assistant.isBusy || assistant.isSearching) && styles.disabled]}
            disabled={!assistant.input.trim() || assistant.isBusy || assistant.isSearching}
            onPress={() => void assistant.submitMessage()}
          >
            <Send color={Theme.colors.surface} size={19} />
          </TouchableOpacity>
        </GlassCard>
      </View>
      ) : null}
      {renderMobilePanelNav()}
    </KeyboardAvoidingView>
  );
}

function discoveryError(message: string) {
  if (message === 'no_active_icp') {
    return 'No active ICP found. Define your Ideal Customer Profile first.';
  }
  if (message.toLowerCase().includes('tenant')) {
    return 'Session tenant could not be resolved. Sign in again or check tenant settings.';
  }
  return message;
}

function ProspectDiscoveryPanel({ onComplete }: { onComplete?: (result: SearchRunResult) => void }) {
  const appTheme = useAppTheme();
  const [maxResults, setMaxResults] = useState(25);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SearchRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const next = await runProspectSearch({ maxResults, triggeredBy: 'manual' });
      setResult(next);
      onComplete?.(next);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setRunning(false);
    }
  };

  const count = result ? result.count ?? result.candidates?.length ?? 0 : 0;
  const searchId = result ? result.searchId ?? result.search_id ?? '' : '';
  const totalCost = result ? Number(result.totalCostUsd ?? result.total_cost_usd ?? 0) : 0;
  const backendResults = result ? result.backendResults ?? result.backend_results ?? {} : {};

  return (
    <GlassCard style={[styles.discoveryPanel, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}>
      <View style={styles.discoveryHeader}>
        <View style={styles.discoveryTitleCopy}>
          <Typography variant="body" color={appTheme.text} style={styles.panelTitle}>Discover new prospects</Typography>
          <Typography variant="caption" color={appTheme.muted}>
            Runs the active ICP search and adds matching prospects to CRM.
          </Typography>
        </View>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={running}
          onPress={runSearch}
          style={[styles.discoveryRunButton, { backgroundColor: appTheme.primaryAccent }, running && styles.disabled]}
        >
          {running ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : null}
          <Typography variant="caption" color={Theme.colors.surface} style={styles.loadMoreText}>
            {running ? 'Running' : 'Run search'}
          </Typography>
        </TouchableOpacity>
      </View>

      <View style={[styles.discoveryOptions, { borderTopColor: appTheme.borderSoft }]}>
        <Typography variant="caption" color={appTheme.muted} style={styles.discoveryOptionLabel}>Max results</Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryOptionScroll}>
          {MAX_RESULTS_OPTIONS.map((option) => {
            const active = option === maxResults;
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.78}
                disabled={running}
                onPress={() => setMaxResults(option)}
                style={[
                  styles.discoveryOption,
                  {
                    backgroundColor: active ? appTheme.primaryAccent : appTheme.softSurface,
                    borderColor: active ? appTheme.primaryAccent : appTheme.border,
                  },
                ]}
              >
                <Typography variant="caption" color={active ? Theme.colors.surface : appTheme.text} style={styles.optionText}>
                  {option}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {running ? (
        <View style={[styles.discoveryStrip, { backgroundColor: appTheme.infoSoft, borderTopColor: appTheme.borderSoft }]}>
          <Typography variant="caption" color={appTheme.primaryAccent}>Calling Apollo + Sales Navigator. Typically 3-8s.</Typography>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.discoveryStrip, { backgroundColor: '#FFF7ED', borderTopColor: '#FDBA74' }]}>
          <Typography variant="caption" color="#C2410C">Search failed: {discoveryError(error)}</Typography>
        </View>
      ) : null}

      {result && !running && !error ? (
        <View style={[styles.discoveryResult, { borderTopColor: appTheme.borderSoft }]}>
          {result.error === 'no_active_icp' ? (
            <Typography variant="caption" color="#C2410C">Search failed: {discoveryError('no_active_icp')}</Typography>
          ) : (
            <>
              <Typography variant="caption" color={appTheme.text} style={styles.discoveryResultText}>
                {count} candidate{count === 1 ? '' : 's'} discovered
                {searchId ? ` - search ${searchId.slice(0, 8)}` : ''}
                {` - cost $${totalCost.toFixed(2)}`}
              </Typography>
              {Object.entries(backendResults).length ? (
                <View style={styles.discoveryBackendRow}>
                  {Object.entries(backendResults).map(([name, rollup]) => (
                    <DiscoveryBackendChip key={name} name={name} rollup={rollup} />
                  ))}
                </View>
              ) : null}
              {count > 0 ? (
                <Typography variant="caption" color={appTheme.muted}>
                  New prospects will appear in CRM after the discovery run completes.
                </Typography>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </GlassCard>
  );
}

function DiscoveryBackendChip({ name, rollup }: { name: string; rollup: SearchBackendRollup }) {
  const appTheme = useAppTheme();
  const label = name.replace(/_/g, ' ');
  const text = rollup.skipped
    ? `${label}: skipped${rollup.reason ? ` - ${rollup.reason}` : ''}`
    : rollup.error
      ? `${label}: error - ${String(rollup.error).slice(0, 32)}`
      : `${label}: ${rollup.candidates ?? 0}${rollup.total_matches != null ? ` / ${rollup.total_matches}` : ''}`;
  return (
    <View style={[styles.discoveryBackendChip, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]}>
      <Typography variant="caption" color={rollup.error ? '#C2410C' : appTheme.text} style={styles.discoveryBackendText}>
        {text}
      </Typography>
    </View>
  );
}

const getJourneyColor = (channel: string) => {
  const normalized = channel.toLowerCase();
  if (normalized.includes('whatsapp')) return '#25D366';
  if (normalized.includes('email')) return '#0B1957';
  if (normalized.includes('voice')) return '#F97316';
  return '#0A66C2';
};

const getJourneyIcon = (channel: string, color: string) => {
  const normalized = channel.toLowerCase();
  if (normalized.includes('whatsapp')) return <MessageSquare color={color} size={20} />;
  if (normalized.includes('email')) return <Mail color={color} size={20} />;
  if (normalized.includes('voice')) return <Zap color={color} size={20} />;
  return <UsersRound color={color} size={20} />;
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  landingContent: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: LANDING_BACKGROUND,
  },
  landingTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  landingBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.small,
  },
  landingMagicBtn: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.large,
  },
  landingHero: {
    alignItems: 'center',
    marginTop: 36,
  },
  landingLogoWrap: {
    width: 82,
    height: 76,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  landingTitle: {
    textAlign: 'center',
    fontWeight: '800',
    marginBottom: Theme.spacing.sm,
    letterSpacing: 0,
    paddingHorizontal: Theme.spacing.sm,
  },
  landingSparkleGhost: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingInputOuter: {
    borderWidth: 1.4,
    borderRadius: 26,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 22,
    paddingBottom: Theme.spacing.md,
    marginTop: 28,
    shadowColor: '#0B1957',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  landingInput: {
    minHeight: 70,
    maxHeight: 128,
    fontSize: 19,
    lineHeight: 27,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 0,
    fontWeight: '500',
  },
  landingInputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Theme.spacing.md,
  },
  landingCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingPremiumChip: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  landingPremiumText: {
    fontWeight: '800',
  },
  landingSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingToolMenu: {
    borderWidth: 1,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    gap: Theme.spacing.xs,
  },
  landingToolItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
  },
  landingToolCopy: {
    flex: 1,
    minWidth: 0,
  },
  landingToolTitle: {
    fontWeight: '900',
  },
  landingSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Theme.spacing.sm,
    marginTop: 26,
  },
  landingSuggestionChip: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    shadowColor: '#0B1957',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  landingSuggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LANDING_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingSuggestionText: {
    flex: 1,
    fontWeight: '700',
    lineHeight: 17,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, minWidth: 0 },
  contextBand: {
    borderBottomWidth: 1,
    paddingVertical: Theme.spacing.sm,
  },
  contextScroll: {
    alignSelf: 'center',
    gap: Theme.spacing.sm,
  },
  contextChip: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  contextText: { fontWeight: '800' },
  messagesContent: {
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
  },
  recentBlock: { marginBottom: Theme.spacing.lg },
  recentTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  recentScroller: { gap: Theme.spacing.sm },
  recentChip: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    maxWidth: 220,
  },
  discoveryPanel: {
    borderRadius: Theme.radius.lg,
    padding: 0,
    marginBottom: Theme.spacing.lg,
    overflow: 'hidden',
  },
  discoveryHeader: {
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  discoveryTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  discoveryRunButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  discoveryOptions: {
    borderTopWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  discoveryOptionLabel: {
    fontWeight: '900',
  },
  discoveryOptionScroll: {
    gap: Theme.spacing.sm,
  },
  discoveryOption: {
    minHeight: 30,
    minWidth: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.sm,
  },
  discoveryStrip: {
    borderTopWidth: 1,
    padding: Theme.spacing.md,
  },
  discoveryResult: {
    borderTopWidth: 1,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  discoveryResultText: {
    fontWeight: '900',
  },
  discoveryBackendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  discoveryBackendChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
  },
  discoveryBackendText: {
    textTransform: 'capitalize',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAssistant: { justifyContent: 'flex-start' },
  botDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    maxWidth: '88%',
    borderWidth: 1,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.md,
  },
  messageText: {
    lineHeight: 20,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  optionText: { fontWeight: '800' },
  inlineLeads: {
    marginTop: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  footer: {
    paddingBottom: Theme.spacing.xl,
  },
  thinkingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.md,
  },
  panel: {
    marginTop: Theme.spacing.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  panelTitle: {
    fontWeight: '900',
    marginBottom: Theme.spacing.sm,
  },
  leadCard: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    marginBottom: Theme.spacing.sm,
  },
  leadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadTitleBlock: { flex: 1, minWidth: 0 },
  leadName: { fontWeight: '900' },
  scorePill: {
    borderRadius: 14,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
  },
  scoreText: { fontWeight: '900' },
  leadMeta: {
    marginTop: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  reasoning: {
    marginTop: Theme.spacing.sm,
    lineHeight: 18,
  },
  leadActions: {
    marginTop: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  smallAction: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  actionText: { fontWeight: '800' },
  loadMoreBtn: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.md,
  },
  loadMoreText: { fontWeight: '900' },
  resultsToggle: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: Theme.spacing.sm,
    paddingRight: Theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultsCount: { fontWeight: '800' },
  resultsChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  journeyCard: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    marginBottom: Theme.spacing.sm,
  },
  journeyTitle: { fontWeight: '900' },
  createJourneyBtn: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createJourneyText: { fontWeight: '900' },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  channelChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  channelChipText: { fontWeight: '800' },
  launchStatusCard: {
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    marginTop: Theme.spacing.sm,
  },
  launchStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  launchStatusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  launchStatusTitle: {
    fontWeight: '900',
    marginBottom: 2,
  },
  launchStatusText: {
    lineHeight: 17,
  },
  launchBtn: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginTop: Theme.spacing.md,
  },
  resultActionBar: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    borderTopWidth: 1,
    paddingTop: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  refineBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refineText: {
    fontWeight: '800',
  },
  journeyBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.sm,
    ...Theme.shadows.medium,
  },
  journeyText: {
    fontWeight: '900',
    textAlign: 'center',
  },
  panelPage: {
    flex: 1,
  },
  panelPageContent: {
    paddingTop: Theme.spacing.lg,
  },
  panelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  panelTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactLoadBtn: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  flowStepper: {
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  flowStepWrap: {
    width: 92,
    alignItems: 'center',
  },
  flowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xs,
  },
  flowStepTitle: {
    fontWeight: '900',
    textAlign: 'center',
  },
  flowStepAction: {
    minHeight: 42,
    textAlign: 'center',
    marginTop: 2,
  },
  recommendedPill: {
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  recommendedText: {
    letterSpacing: 0,
    fontSize: 8,
  },
  inputArea: {
    borderTopWidth: 1,
    paddingTop: Theme.spacing.md,
  },
  inputCard: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  disabled: { opacity: 0.5 },
  bottomPanelNavWrap: {
    position: 'absolute',
    left: Theme.spacing.md,
    right: Theme.spacing.md,
    bottom: 0,
    zIndex: 30,
  },
  bottomPanelNav: {
    minHeight: 64,
    borderRadius: 32,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Theme.spacing.md,
    ...Theme.shadows.large,
  },
  panelNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelNavIcon: {
    width: 38,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelNavLabel: {
    letterSpacing: 0,
    marginTop: 1,
  },
});
