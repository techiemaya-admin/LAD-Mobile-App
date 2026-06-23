import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Bot, CheckCircle2, ChevronDown, Phone, RefreshCw, Save } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { Logo } from '@/components/ui/Logo';
import {
  fetchVoiceCallOptions,
  isSavedVoiceConfigAvailable,
  loadVoiceCallConfig,
  phoneNumbersMatch,
  saveVoiceCallConfig,
  syncVoiceAgentCallPrompt,
  VoiceAgentOption,
  VoiceNumberOption,
} from '@/src/services/voiceCallConfig';

const DEFAULT_CONTEXT = 'You are placing an outbound call from LAD for TechieMaya. Start speaking immediately when the person answers. Open with: "Hello, this is an AI assistant from TechieMaya. Am I speaking with you at a good time?" Then explain the call purpose clearly, listen, and respond politely.';
const DARK_LOGO_STYLE = Platform.OS === 'web'
  ? ({ filter: 'brightness(0) invert(1)', opacity: 0.95 } as const)
  : ({ tintColor: '#F8FAFC', opacity: 0.95 } as const);

type AIVoiceCallingSettingsProps = {
  darkMode?: boolean;
};

export function AIVoiceCallingSettings({ darkMode = false }: AIVoiceCallingSettingsProps) {
  const palette = darkMode
    ? {
        surface: '#0B1220',
        input: '#111827',
        text: '#F8FAFC',
        muted: '#CBD5E1',
        disabled: '#94A3B8',
        border: '#243049',
        borderSoft: '#1F2937',
        primary: '#AFC2FF',
        primaryFill: Theme.colors.primary,
        infoSoft: 'rgba(175, 194, 255, 0.14)',
        errorSoft: 'rgba(239, 68, 68, 0.14)',
        errorBorder: 'rgba(239, 68, 68, 0.32)',
      }
    : {
        surface: Theme.colors.surface,
        input: '#F8FAFC',
        text: Theme.colors.text,
        muted: Theme.colors.textSecondary,
        disabled: Theme.colors.textDisabled,
        border: Theme.colors.border,
        borderSoft: Theme.colors.borderLight,
        primary: Theme.colors.primary,
        primaryFill: Theme.colors.primary,
        infoSoft: Theme.colors.infoLight,
        errorSoft: '#FEF2F2',
        errorBorder: '#FECACA',
      };
  const [agents, setAgents] = useState<VoiceAgentOption[]>([]);
  const [numbers, setNumbers] = useState<VoiceNumberOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedNumberId, setSelectedNumberId] = useState<string>();
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isNumberMenuOpen, setIsNumberMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState('Save an agent and number here, then use Call with Agent from the dial pad.');
  const [error, setError] = useState<string | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId),
    [agents, selectedAgentId],
  );

  const selectedNumber = useMemo(
    () => numbers.find((number) => number.id === selectedNumberId),
    [numbers, selectedNumberId],
  );

  const refreshOptions = useCallback(async (options: { force?: boolean } = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const saved = await loadVoiceCallConfig();
      const voiceOptions = await fetchVoiceCallOptions({ force: options.force });

      setAgents(voiceOptions.agents);
      setNumbers(voiceOptions.numbers);

      const savedIsValid = isSavedVoiceConfigAvailable(saved, voiceOptions.agents, voiceOptions.numbers);
      const savedAgent = savedIsValid ? voiceOptions.agents.find((agent) => agent.id === saved?.agentId) : undefined;
      const savedNumber = savedIsValid ? voiceOptions.numbers.find((number) => phoneNumbersMatch(number.phoneNumber, saved?.fromNumber)) : undefined;
      const assignedSavedAgent = savedNumber?.assignedAgentId
        ? voiceOptions.agents.find((agent) => agent.id === savedNumber.assignedAgentId)
        : undefined;
      const firstAgent = voiceOptions.agents[0];
      const firstNumber = voiceOptions.numbers.find((number) => number.assignedAgentId === (assignedSavedAgent?.id || savedAgent?.id || firstAgent?.id)) || voiceOptions.numbers[0];
      const initialAgentId = assignedSavedAgent?.id || savedAgent?.id || firstNumber?.assignedAgentId || firstAgent?.id;

      const initialContext = saved?.context || DEFAULT_CONTEXT;
      const initialAgent = initialAgentId ? voiceOptions.agents.find((agent) => agent.id === initialAgentId) : undefined;

      setSelectedAgentId(initialAgentId);
      setSelectedNumberId(savedNumber?.id || firstNumber?.id);
      setContext(initialContext);

      if (savedIsValid && initialAgent) {
        setStatus('Saved!');
        void syncVoiceAgentCallPrompt(initialAgent, initialContext)
          .then((syncedAgentPrompt) => {
            setAgents((currentAgents) => currentAgents.map((agent) => (
              agent.id === initialAgent.id
                ? { ...agent, ...syncedAgentPrompt }
                : agent
            )));
            setError(null);
          })
          .catch((syncError) => {
            const syncMessage = syncError instanceof Error ? syncError.message : 'Could not sync backend starter prompt.';
            setError(syncMessage);
          });
        return;
      }

      setStatus(
        saved
          ? 'Old saved number is not available for this user. Select a listed number and save again.'
          : 'Select a voice agent and calling number, then save.',
      );    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load voice call options.';
      setError(message);
      setStatus('Voice call options could not be loaded from the backend.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOptions();
  }, [refreshOptions]);

  const handleSelectAgent = useCallback((agent: VoiceAgentOption) => {
    setSelectedAgentId(agent.id);
    setIsAgentMenuOpen(false);

    const linkedNumber = numbers.find((number) => number.assignedAgentId === agent.id);
    if (linkedNumber) {
      setSelectedNumberId(linkedNumber.id);
    }
  }, [numbers]);

  const handleSave = useCallback(async () => {
    if (!selectedNumber) {
      setStatus('Please select a calling number');
      setSavedSuccess(false);
      return;
    }

    const assignedAgent = selectedNumber.assignedAgentId
      ? agents.find((agent) => agent.id === selectedNumber.assignedAgentId)
      : undefined;
    const effectiveAgent = assignedAgent || selectedAgent;

    if (!effectiveAgent) {
      setStatus('Please select a voice agent');
      setSavedSuccess(false);
      return;
    }

    const savedContext = context.trim() || DEFAULT_CONTEXT;

    setIsSaving(true);
    try {
      await saveVoiceCallConfig({
        agentId: effectiveAgent.id,
        agentName: effectiveAgent.name,
        fromNumber: selectedNumber.phoneNumber,
        fromNumberLabel: selectedNumber.label,
        context: savedContext,
        savedAt: new Date().toISOString(),
      });

      setSelectedAgentId(effectiveAgent.id);
      setStatus('Saved!');
      // Show inline success indicator inside the card (no blocking Alert dialog)
      setSavedSuccess(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedSuccess(false), 3000);

      void syncVoiceAgentCallPrompt(effectiveAgent, savedContext)
        .then((syncedAgentPrompt) => {
          setAgents((currentAgents) => currentAgents.map((agent) => (
            agent.id === effectiveAgent.id
              ? { ...agent, ...syncedAgentPrompt }
              : agent
          )));
          setError(null);
        })
        .catch((syncError) => {
          const syncMessage = syncError instanceof Error ? syncError.message : 'Backend prompt sync is still pending.';
          setError(syncMessage);
          setStatus('Saved locally. Backend sync will retry on refresh.');
        });
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : 'Save failed');
      setSavedSuccess(false);
    } finally {
      setIsSaving(false);
    }
  }, [agents, context, selectedAgent, selectedNumber]);

  // Clean up auto-hide timer on unmount
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

  return (
    <View style={[styles.aiPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.aiPanelHeader}>
        <Logo variant="main" width={92} height={30} style={darkMode ? DARK_LOGO_STYLE : undefined} />
        <View style={styles.aiTitleBlock}>
          <Typography variant="h3" color={palette.text} style={styles.aiTitle}>AI Voice Calling</Typography>
          <Typography variant="caption" color={palette.muted}>
            Saved setup for dial-pad agent calls
          </Typography>
        </View>
        <Bot color={palette.primary} size={22} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.refreshButton, { backgroundColor: palette.input, borderColor: palette.border }]} onPress={() => void refreshOptions({ force: true })} activeOpacity={0.75} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={palette.primary} size="small" /> : <RefreshCw color={palette.primary} size={16} />}
          <Typography variant="caption" color={palette.primary} style={styles.refreshText}>Refresh</Typography>
        </TouchableOpacity>
        <View style={[
          styles.savedHint,
          { backgroundColor: savedSuccess ? (darkMode ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : palette.input },
          savedSuccess && { borderWidth: 1, borderColor: '#10B981' },
        ]}>
          <CheckCircle2 color="#10B981" size={15} />
          <Typography
            variant="caption"
            color={savedSuccess ? '#10B981' : palette.muted}
            numberOfLines={1}
            style={savedSuccess ? { fontWeight: '700' } : undefined}
          >
            {savedSuccess ? '✓ Saved!' : status}
          </Typography>
        </View>
      </View>

      <View style={styles.selectorSection}>
        <Typography variant="caption" color={palette.muted} style={styles.sectionLabel}>AI Voice Agent</Typography>
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            { backgroundColor: palette.input, borderColor: palette.border },
            isAgentMenuOpen && { backgroundColor: palette.infoSoft, borderColor: palette.primary },
          ]}
          onPress={() => {
            setIsAgentMenuOpen((value) => !value);
            setIsNumberMenuOpen(false);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.dropdownTextBlock}>
            <Typography variant="bodySmall" color={palette.text} style={styles.optionText} numberOfLines={1}>
              {selectedAgent?.name || 'Select voice agent'}
            </Typography>
            <Typography variant="overline" color={palette.muted} numberOfLines={1}>
              {selectedAgent ? [selectedAgent.language, selectedAgent.accent, selectedAgent.gender].filter(Boolean).join(' / ') || selectedAgent.provider || 'Available agent' : 'Loaded from backend'}
            </Typography>
          </View>
          <ChevronDown color={palette.muted} size={18} />
        </TouchableOpacity>
        {isAgentMenuOpen && (
          <View style={[styles.menuCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {agents.length === 0 ? (
              <Typography variant="caption" color={palette.muted}>No voice agents loaded.</Typography>
            ) : agents.map((agent) => (
              <TouchableOpacity key={agent.id} style={[styles.menuItem, { borderBottomColor: palette.borderSoft }]} onPress={() => handleSelectAgent(agent)} activeOpacity={0.72}>
                <Typography variant="caption" color={selectedAgentId === agent.id ? palette.primary : palette.text} style={styles.optionText} numberOfLines={1}>
                  {agent.name}
                </Typography>
                <Typography variant="overline" color={palette.muted} numberOfLines={1}>
                  {[agent.language, agent.accent, agent.gender].filter(Boolean).join(' / ') || agent.provider || 'Voice agent'}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.selectorSection}>
        <Typography variant="caption" color={palette.muted} style={styles.sectionLabel}>Agent Calling Number</Typography>
        <TouchableOpacity
          style={[
            styles.dropdownButton,
            { backgroundColor: palette.input, borderColor: palette.border },
            isNumberMenuOpen && { backgroundColor: palette.infoSoft, borderColor: palette.primary },
          ]}
          onPress={() => {
            setIsNumberMenuOpen((value) => !value);
            setIsAgentMenuOpen(false);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.dropdownTextBlock}>
            <Typography variant="bodySmall" color={palette.text} style={styles.optionText} numberOfLines={1}>
              {selectedNumber?.label || 'Select agent number'}
            </Typography>
            <Typography variant="overline" color={palette.muted} numberOfLines={1}>
              {selectedNumber?.phoneNumber || 'Verified backend number'}
            </Typography>
          </View>
          <ChevronDown color={palette.muted} size={18} />
        </TouchableOpacity>
        {isNumberMenuOpen && (
          <View style={[styles.menuCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {numbers.length === 0 ? (
              <Typography variant="caption" color={palette.muted}>No calling numbers loaded.</Typography>
            ) : numbers.map((number) => (
              <TouchableOpacity
                key={number.id}
                style={[styles.menuItem, { borderBottomColor: palette.borderSoft }]}
                onPress={() => {
                  setSelectedNumberId(number.id);
                  if (number.assignedAgentId) {
                    setSelectedAgentId(number.assignedAgentId);
                  }
                  setIsNumberMenuOpen(false);
                }}
                activeOpacity={0.72}
              >
                <Typography variant="caption" color={selectedNumberId === number.id ? palette.primary : palette.text} style={styles.optionText} numberOfLines={1}>
                  {number.label}
                </Typography>
                <Typography variant="overline" color={palette.muted} numberOfLines={1}>
                  {number.phoneNumber}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.selectorSection}>
        <Typography variant="caption" color={palette.muted} style={styles.sectionLabel}>Content / Call Instructions</Typography>
        <TextInput
          placeholder="Tell the agent what to say or focus on during calls"
          placeholderTextColor={palette.disabled}
          multiline
          value={context}
          onChangeText={setContext}
          style={[
            styles.instructionsInput,
            {
              backgroundColor: palette.input,
              borderColor: palette.border,
              color: palette.text,
            },
          ]}
        />
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: palette.errorSoft, borderColor: palette.errorBorder }]}>
          <Typography variant="caption" color={Theme.colors.error}>{error}</Typography>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: palette.primaryFill }, (isSaving || isLoading) && styles.disabledButton]}
        disabled={isSaving || isLoading}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        {isSaving ? <ActivityIndicator color={Theme.colors.surface} size="small" /> : <Save color={Theme.colors.surface} size={17} />}
        <Typography variant="bodySmall" style={styles.saveButtonText}>{isSaving ? 'Saving setup...' : 'Save Voice Call Setup'}</Typography>
      </TouchableOpacity>

      <View style={[styles.dialInfoBox, { backgroundColor: palette.input }]}>
        <Phone color={palette.primary} size={16} />
        <Typography variant="caption" color={palette.muted} style={styles.dialInfoText}>
          After saving, open Calls, enter any number, and tap Call with Agent.
        </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aiPanel: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: Theme.spacing.md,
    ...Theme.shadows.small,
  },
  aiPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  aiTitleBlock: { flex: 1 },
  aiTitle: { fontSize: 18, lineHeight: 24 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  refreshButton: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: '#F8FAFC',
  },
  refreshText: {
    fontWeight: '800',
  },
  savedHint: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  selectorSection: { marginBottom: Theme.spacing.md },
  sectionLabel: {
    fontWeight: '800',
    marginBottom: Theme.spacing.xs,
  },
  dropdownButton: {
    minHeight: 58,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: '#F8FAFC',
    padding: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  dropdownButtonActive: {
    borderColor: Theme.colors.primary,
    backgroundColor: Theme.colors.infoLight,
  },
  dropdownTextBlock: { flex: 1 },
  optionText: {
    fontWeight: '800',
  },
  optionTextActive: { color: Theme.colors.primary },
  menuCard: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surface,
    marginTop: Theme.spacing.xs,
    padding: Theme.spacing.xs,
    ...Theme.shadows.small,
  },
  menuItem: {
    padding: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  instructionsInput: {
    minHeight: 96,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    backgroundColor: '#F8FAFC',
    padding: Theme.spacing.md,
    color: Theme.colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  errorBox: {
    borderRadius: Theme.radius.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  saveButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  disabledButton: { opacity: 0.65 },
  saveButtonText: {
    color: Theme.colors.surface,
    fontWeight: '800',
  },
  dialInfoBox: {
    marginTop: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    backgroundColor: '#F8FAFC',
    padding: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  dialInfoText: { flex: 1 },
});


