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
import { ArrowLeft, Bot, Building2, Check, ChevronDown, ExternalLink, History, MessageSquare, RefreshCw, Search, Send, Sparkles, UserRound, UsersRound, Zap } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { Typography } from '@/components/ui/Typography';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useAdvancedSearch } from '@/src/hooks/useAdvancedSearch';
import { AssistantChatMessage, MobileAssistantLead } from '@/src/services/mobileAIAssistantService';
import { useAppTheme } from '@/src/theme/appTheme';

const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

const scoreTone = (score?: number) => {
  if ((score ?? 0) >= 70) return { bg: '#DCFCE7', fg: '#166534', label: 'Strong' };
  if ((score ?? 0) >= 45) return { bg: '#FEF9C3', fg: '#854D0E', label: 'Moderate' };
  return { bg: '#E0E7FF', fg: '#3730A3', label: 'Match' };
};

export default function AIAssistantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const { width } = useWindowDimensions();
  const assistant = useAdvancedSearch();
  const listRef = useRef<FlatList<AssistantChatMessage>>(null);
  const [showLeadResults, setShowLeadResults] = useState(true);
  const [activePanel, setActivePanel] = useState<'chat' | 'leads' | 'flow'>('chat');
  const isCompact = width < 520;
  const horizontalPadding = isCompact ? Theme.spacing.md : Theme.spacing.xl;
  const contentMaxWidth = width >= 900 ? 860 : undefined;
  const hasLeads = assistant.leads.length > 0;

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [assistant.messages.length, assistant.isBusy, assistant.isSearching]);

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
            <Bot color={appTheme.primaryAccent} size={16} />
          </View>
        ) : null}
        <View style={[
          styles.bubble,
          {
            backgroundColor: isUser ? appTheme.primaryAccent : appTheme.surface,
            borderColor: isUser ? appTheme.primaryAccent : appTheme.border,
          },
        ]}>
          <Typography variant="bodySmall" color={isUser ? Theme.colors.surface : appTheme.text} style={styles.messageText}>
            {item.text}
          </Typography>
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
      ? 'Sending the campaign, leads, channels, and workflow steps to the LAD backend.'
      : assistant.outreachWorkflowStage === 'launched'
        ? assistant.launchedCampaignId
          ? `Campaign ID ${assistant.launchedCampaignId} is now available in Campaigns.`
          : 'The LAD backend accepted the journey. You can monitor it from Campaigns.'
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
          <Typography variant="caption" color={appTheme.muted}>Suggested outreach journey from LAD Frontend 2</Typography>
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
            LAD Frontend 2 workflow, mobile optimized
          </Typography>
        </View>
        <TouchableOpacity onPress={assistant.resetConversation} style={[styles.iconBtn, { backgroundColor: appTheme.softSurface, borderColor: appTheme.border }]} activeOpacity={0.76}>
          <RefreshCw color={appTheme.muted} size={19} />
        </TouchableOpacity>
      </View>

      <View style={[styles.contextBand, { paddingHorizontal: horizontalPadding, backgroundColor: appTheme.surface, borderBottomColor: appTheme.borderSoft }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.contextScroll, { maxWidth: contentMaxWidth }]}>
          <View style={[styles.contextChip, { backgroundColor: appTheme.infoSoft }]}>
            <Sparkles color={appTheme.primaryAccent} size={15} />
            <Typography variant="caption" color={appTheme.text} style={styles.contextText}>Lead chat</Typography>
          </View>
          <View style={[styles.contextChip, { backgroundColor: appTheme.successSoft }]}>
            <Search color={Theme.colors.success} size={15} />
            <Typography variant="caption" color={appTheme.text} style={styles.contextText}>Unified search</Typography>
          </View>
          <View style={[styles.contextChip, { backgroundColor: appTheme.warningSoft }]}>
            <Zap color={Theme.colors.warning} size={15} />
            <Typography variant="caption" color={appTheme.text} style={styles.contextText}>{assistant.leads.length} leads</Typography>
          </View>
          {assistant.lastModuleUsed ? (
            <View style={[styles.contextChip, { backgroundColor: appTheme.softSurface }]}>
              <Typography variant="caption" color={appTheme.muted} style={styles.contextText}>{assistant.lastModuleUsed.replace(/_/g, ' ')}</Typography>
            </View>
          ) : null}
        </ScrollView>
      </View>

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
                  {assistant.isSearching ? 'Searching LAD backend...' : 'Assistant is thinking...'}
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
  if (normalized.includes('email')) return <Bot color={color} size={20} />;
  if (normalized.includes('voice')) return <Zap color={color} size={20} />;
  return <UsersRound color={color} size={20} />;
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
