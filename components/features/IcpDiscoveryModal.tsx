/**
 * ICP Discovery modal — mobile port of LAD-Frontend-2's "ICP Discovery" drawer
 * (advanced-search-ai page, AI Playground).
 *
 * Same workflow as the web:
 *  • Empty state → "Start AI Setup" resets the backend conversation and sends
 *    the `__init__` bootstrap message for the AI greeting.
 *  • Each assistant turn may carry a "card" (text / textarea / chips / radio /
 *    tags / hours) that captures one business-profile field; submissions are
 *    sent back as `[Card submission: field=<f> value=<v>]`.
 *  • Textarea cards offer "Generate with AI" via /api/ai-playground/suggest.
 *  • Header shows shared profile-completeness math (same numbers as web).
 *  • Free-text input lets the user answer conversationally or skip.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Check, Edit3, Lightbulb, RotateCcw, Sparkles, X } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { LadLogoMark } from '@/components/ui/LadLogoMark';
import { LadThinkingBubble } from '@/components/ui/LadThinkingBubble';
import { useAppTheme } from '@/src/theme/appTheme';
import {
  BusinessProfile,
  PlaygroundCard,
  PlaygroundChatTurn,
  SINGLE_SELECT_CHIP_FIELDS,
  computeCompleteness,
  playgroundChat,
  playgroundReset,
  playgroundSuggest,
} from '@/src/services/aiPlaygroundService';

const NAVY = '#0B1957';
const NAVY_SOFT = '#1A3A8F';

interface IcpDiscoveryModalProps {
  visible: boolean;
  onClose: () => void;
  /** Notifies the parent when the profile changes so it can refresh the green dot. */
  onProfileChange?: (profile: BusinessProfile) => void;
}

export function IcpDiscoveryModal({ visible, onClose, onProfileChange }: IcpDiscoveryModalProps) {
  const router = useRouter();
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [history, setHistory] = useState<PlaygroundChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [card, setCard] = useState<PlaygroundCard | null>(null);
  const [cardValues, setCardValues] = useState<Record<string, any>>({});
  const [tagInput, setTagInput] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [profile, setProfile] = useState<BusinessProfile>({});

  const completeness = useMemo(() => computeCompleteness(profile), [profile]);
  const pct = isComplete ? 100 : completeness.pct;
  const filled = isComplete ? completeness.total : completeness.filled;

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 90);
    return () => clearTimeout(timer);
  }, [history.length, busy, card]);

  const applyResponse = useCallback((data: Awaited<ReturnType<typeof playgroundChat>>, currentProfile: BusinessProfile) => {
    if (!data.success && !data.reply) return;
    setHistory((prev) => [...prev, { role: 'assistant', content: data.reply || '', card: data.card }]);
    if (data.card) {
      setCard(data.card);
      const existing = data.card.field ? currentProfile[data.card.field] : undefined;
      if (typeof existing === 'string' && existing) {
        if (data.card.type === 'tags') {
          setCardValues({ [data.card.field]: existing.split(',').map((item) => item.trim()).filter(Boolean) });
        } else {
          setCardValues({ [data.card.field]: existing });
        }
      } else {
        setCardValues({});
      }
    }
    if (data.profile) {
      setProfile((prev) => {
        const next = { ...prev, ...data.profile };
        onProfileChange?.(next);
        return next;
      });
    }
    if (data.isComplete) setIsComplete(true);
  }, [onProfileChange]);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setCard(null);
    setHistory((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    try {
      const data = await playgroundChat(message);
      applyResponse(data, profile);
    } catch {
      setHistory((prev) => [...prev, {
        role: 'assistant',
        content: 'I could not reach the assistant. Check your connection and try again.',
      }]);
    }
    setBusy(false);
  }, [busy, profile, applyResponse]);

  const startConversation = useCallback(async () => {
    setHistory([]);
    setCard(null);
    setCardValues({});
    setIsComplete(false);
    setBusy(true);
    await playgroundReset().catch(() => undefined);
    try {
      const data = await playgroundChat('__init__');
      if (data.success && data.reply) {
        setHistory([{ role: 'assistant', content: data.reply, card: data.card }]);
        if (data.card) setCard(data.card);
        if (data.profile) {
          setProfile((prev) => {
            const next = { ...prev, ...data.profile };
            onProfileChange?.(next);
            return next;
          });
        }
      }
    } catch {
      setHistory([{ role: 'assistant', content: 'I could not start the setup. Please try again.' }]);
    }
    setBusy(false);
  }, [onProfileChange]);

  const submitCard = useCallback(async () => {
    if (!card) return;
    const { field, type } = card;
    let value = cardValues[field];
    if (type === 'tags') {
      const committed: string[] = Array.isArray(value) ? [...value] : [];
      if (tagInput.trim()) {
        tagInput.split(',').map((item) => item.trim()).filter(Boolean).forEach((tag) => {
          if (!committed.includes(tag)) committed.push(tag);
        });
        setTagInput('');
      }
      value = committed.join(', ');
    } else if (type === 'chips') {
      value = Array.isArray(value) ? value.join(', ') : (value || '');
    } else if (type === 'hours') {
      const hours = value && typeof value === 'object' ? value : {};
      value = `${hours.from || '09:00'} - ${hours.to || '18:00'}`;
    }
    setProfile((prev) => {
      const next = { ...prev, [field]: String(value || '') };
      onProfileChange?.(next);
      return next;
    });
    await sendMessage(`[Card submission: field=${field} value=${value}]`);
  }, [card, cardValues, tagInput, sendMessage, onProfileChange]);

  const generateSuggestion = useCallback(async () => {
    if (!card || suggesting) return;
    setSuggesting(true);
    try {
      const suggestion = await playgroundSuggest({
        field: card.field,
        label: card.label,
        placeholder: card.placeholder,
        profile,
      });
      if (suggestion) setCardValues((prev) => ({ ...prev, [card.field]: suggestion }));
    } catch {
      // Suggestion is optional — the user can still type manually.
    }
    setSuggesting(false);
  }, [card, suggesting, profile]);

  const openProfileEditor = useCallback(() => {
    onClose();
    router.push('/(drawer)/business-profile' as never);
  }, [onClose, router]);

  const renderCard = () => {
    if (!card || busy) return null;
    const fieldVal = cardValues[card.field];
    const canSubmit = Boolean(fieldVal) || Boolean(tagInput.trim()) || card.type === 'hours';

    return (
      <View style={[styles.cardBox, { backgroundColor: appTheme.surface, borderColor: appTheme.darkMode ? appTheme.border : '#DCE3F5' }]}>
        <View style={styles.cardLabelRow}>
          <Sparkles color={appTheme.primaryAccent} size={13} />
          <Typography variant="caption" color={appTheme.primaryAccent} style={styles.cardLabel}>
            {card.label}
          </Typography>
        </View>

        {(card.type === 'text' || card.type === 'textarea') && (
          <View>
            <TextInput
              style={[
                styles.cardTextInput,
                card.type === 'textarea' && styles.cardTextArea,
                { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface },
              ]}
              value={typeof fieldVal === 'string' ? fieldVal : ''}
              onChangeText={(text) => setCardValues({ [card.field]: text })}
              placeholder={card.placeholder || ''}
              placeholderTextColor={appTheme.disabled}
              multiline={card.type === 'textarea'}
              autoFocus
            />
            {card.type === 'textarea' && (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={suggesting}
                onPress={() => void generateSuggestion()}
                style={[styles.suggestBtn, { backgroundColor: suggesting ? appTheme.border : NAVY }]}
              >
                {suggesting ? (
                  <ActivityIndicator color={appTheme.muted} size="small" />
                ) : (
                  <Sparkles color="#FFFFFF" size={12} />
                )}
                <Typography variant="overline" color={suggesting ? appTheme.muted : '#FFFFFF'} style={styles.suggestText}>
                  {suggesting ? 'Generating…' : 'Generate with AI'}
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        )}

        {card.type === 'chips' && (
          <View style={styles.chipWrap}>
            {(card.options || []).map((option) => {
              const selected = Array.isArray(fieldVal) ? fieldVal.includes(option) : fieldVal === option;
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.78}
                  onPress={() => {
                    if (SINGLE_SELECT_CHIP_FIELDS.has(card.field)) {
                      setCardValues({ [card.field]: option });
                    } else {
                      const current = Array.isArray(fieldVal) ? [...fieldVal] : [];
                      const index = current.indexOf(option);
                      if (index >= 0) current.splice(index, 1); else current.push(option);
                      setCardValues({ [card.field]: current });
                    }
                  }}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: appTheme.darkMode ? appTheme.labelBackgroundActive : NAVY, borderColor: appTheme.darkMode ? appTheme.labelBorder : NAVY }
                      : { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : appTheme.softSurface, borderColor: appTheme.darkMode ? appTheme.labelBorder : appTheme.border },
                  ]}
                >
                  <Typography variant="caption" color={selected ? (appTheme.darkMode ? appTheme.labelText : '#FFFFFF') : appTheme.text}>{option}</Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {card.type === 'radio' && (
          <View style={styles.radioColumn}>
            {(card.options || []).map((option) => {
              const selected = fieldVal === option;
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.78}
                  onPress={() => setCardValues({ [card.field]: option })}
                  style={[
                    styles.radioRow,
                    {
                      borderColor: selected ? NAVY : appTheme.border,
                      backgroundColor: selected ? (appTheme.darkMode ? appTheme.infoSoft : '#F0F3FF') : appTheme.surface,
                      borderWidth: selected ? 2 : 1.5,
                    },
                  ]}
                >
                  <View style={[styles.radioDot, { borderColor: selected ? NAVY : appTheme.border, backgroundColor: selected ? NAVY : 'transparent' }]} />
                  <Typography variant="bodySmall" color={appTheme.text}>{option}</Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {card.type === 'tags' && (
          <View>
            <View style={styles.chipWrap}>
              {(Array.isArray(fieldVal) ? fieldVal : []).map((tag: string, index: number) => (
                <View key={`${tag}-${index}`} style={[styles.tagPill, { backgroundColor: appTheme.darkMode ? appTheme.labelBackground : '#DCE3F5', borderColor: appTheme.darkMode ? appTheme.labelBorder : 'transparent', borderWidth: appTheme.darkMode ? 1 : 0 }]}>
                  <Typography variant="caption" color={appTheme.darkMode ? appTheme.text : NAVY} style={styles.tagText}>{tag}</Typography>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => {
                      const updated = [...fieldVal];
                      updated.splice(index, 1);
                      setCardValues({ [card.field]: updated });
                    }}
                  >
                    <X size={11} color={appTheme.darkMode ? appTheme.text : NAVY} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <TextInput
              style={[styles.cardTextInput, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder={card.placeholder || 'Type and press enter'}
              placeholderTextColor={appTheme.disabled}
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (!tagInput.trim()) return;
                const current = Array.isArray(fieldVal) ? [...fieldVal] : [];
                tagInput.split(',').map((item) => item.trim()).filter(Boolean).forEach((tag) => {
                  if (!current.includes(tag)) current.push(tag);
                });
                setCardValues({ [card.field]: current });
                setTagInput('');
              }}
            />
          </View>
        )}

        {card.type === 'hours' && (
          <View style={styles.hoursRow}>
            <View style={styles.hoursCol}>
              <Typography variant="overline" color={appTheme.muted}>From</Typography>
              <TextInput
                style={[styles.cardTextInput, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
                value={(fieldVal as any)?.from ?? '09:00'}
                onChangeText={(text) => setCardValues({ [card.field]: { ...(fieldVal as any || {}), from: text } })}
                placeholder="09:00"
                placeholderTextColor={appTheme.disabled}
              />
            </View>
            <Typography variant="body" color={appTheme.muted} style={styles.hoursDash}>–</Typography>
            <View style={styles.hoursCol}>
              <Typography variant="overline" color={appTheme.muted}>To</Typography>
              <TextInput
                style={[styles.cardTextInput, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
                value={(fieldVal as any)?.to ?? '18:00'}
                onChangeText={(text) => setCardValues({ [card.field]: { ...(fieldVal as any || {}), to: text } })}
                placeholder="18:00"
                placeholderTextColor={appTheme.disabled}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.82}
          disabled={!canSubmit}
          onPress={() => void submitCard()}
          style={[styles.cardSubmit, { backgroundColor: canSubmit ? NAVY : appTheme.border }]}
        >
          <Typography variant="caption" color={canSubmit ? '#FFFFFF' : appTheme.muted} style={styles.cardSubmitText}>
            Submit
          </Typography>
          <ArrowRight color={canSubmit ? '#FFFFFF' : appTheme.muted} size={14} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: appTheme.background }]}
        behavior="padding"
      >
        {/* Header */}
        <View style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: appTheme.darkMode ? appTheme.surface : '#EEF2FF',
            borderBottomColor: appTheme.border,
          },
        ]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerIcon}>
                <Lightbulb color="#FFFFFF" size={17} />
              </View>
              <View style={styles.headerCopy}>
                <Typography variant="body" color={appTheme.text} style={styles.headerTitle}>ICP Discovery</Typography>
                <Typography
                  variant="caption"
                  color={appTheme.darkMode ? appTheme.muted : NAVY}
                  numberOfLines={2}
                  style={styles.headerSubtitle}
                >
                  {isComplete ? 'ICP profile complete!' : 'Answer questions to power smarter lead discovery'}
                </Typography>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => void startConversation()}
                style={[styles.headerBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
              >
                <RotateCcw color={appTheme.muted} size={14} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={onClose}
                style={[styles.headerBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]}
              >
                <X color={appTheme.muted} size={15} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Completeness bar */}
          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <Typography variant="overline" color={appTheme.muted}>Profile completeness</Typography>
              <Typography variant="overline" color={pct >= 70 ? '#10B981' : appTheme.darkMode ? appTheme.primaryAccent : NAVY} style={styles.progressPct}>
                {pct}% ({filled}/{completeness.total} fields)
              </Typography>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: appTheme.darkMode ? appTheme.border : '#DCE3F5' }]}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 70 ? '#10B981' : NAVY_SOFT }]} />
            </View>
            {filled > 0 ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={openProfileEditor}
                style={[styles.reviewBtn, { backgroundColor: appTheme.surface, borderColor: appTheme.darkMode ? appTheme.border : '#C7D2FE' }]}
              >
                <Edit3 color={appTheme.darkMode ? appTheme.primaryAccent : NAVY} size={13} />
                <Typography variant="caption" color={appTheme.darkMode ? appTheme.text : NAVY} style={styles.reviewText}>
                  Review &amp; edit your {completeness.total} fields
                </Typography>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Conversation */}
        <ScrollView
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {history.length === 0 && !busy ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyLogo, { backgroundColor: appTheme.darkMode ? appTheme.infoSoft : '#EEF2FF' }]}>
                <LadLogoMark color={appTheme.darkMode ? '#FFFFFF' : NAVY} size={42} />
              </View>
              <Typography variant="h4" color={appTheme.text} style={styles.emptyTitle}>
                Define Your Ideal Customer Profile
              </Typography>
              <Typography variant="bodySmall" color={appTheme.muted} style={styles.emptyBody}>
                Answer a few questions about your business and I&apos;ll identify exactly who you should target for outreach.
              </Typography>
              <TouchableOpacity activeOpacity={0.85} onPress={() => void startConversation()} style={styles.startBtn}>
                <Sparkles color="#FFFFFF" size={16} />
                <Typography variant="body" color="#FFFFFF" style={styles.startBtnText}>Start AI Setup</Typography>
              </TouchableOpacity>
            </View>
          ) : null}

          {history.map((turn, index) => (
            turn.role === 'user' ? (
              <View key={index} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Typography variant="bodySmall" color="#FFFFFF" style={styles.bubbleText}>
                    {turn.content.startsWith('[Card submission:') ? '✅ Submitted' : turn.content}
                  </Typography>
                </View>
              </View>
            ) : (
              <View key={index} style={styles.aiRow}>
                <View style={[styles.aiAvatar, { backgroundColor: appTheme.darkMode ? appTheme.infoSoft : '#E8ECFA' }]}>
                  <LadLogoMark color={appTheme.darkMode ? '#FFFFFF' : NAVY} size={22} />
                </View>
                <View style={[styles.aiBubble, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
                  <Typography variant="bodySmall" color={appTheme.text} style={styles.bubbleText}>{turn.content}</Typography>
                </View>
              </View>
            )
          ))}

          {busy ? (
            <LadThinkingBubble
              accentColor={appTheme.darkMode ? '#FFFFFF' : NAVY}
              avatarBackground={appTheme.darkMode ? appTheme.infoSoft : '#E8ECFA'}
              bubbleBackground={appTheme.surface}
              bubbleBorder={appTheme.borderSoft}
              logoColor={appTheme.darkMode ? '#FFFFFF' : NAVY}
            />
          ) : null}

          {renderCard()}
        </ScrollView>

        {/* Input bar */}
        {history.length > 0 ? (
          <View style={[
            styles.inputBar,
            { borderTopColor: appTheme.border, backgroundColor: appTheme.surface, paddingBottom: Math.max(insets.bottom, 10) },
          ]}>
            <TextInput
              style={[styles.input, { color: appTheme.text, borderColor: appTheme.border, backgroundColor: appTheme.softSurface }]}
              value={input}
              onChangeText={setInput}
              editable={!busy}
              placeholder="Type a message or skip to next question…"
              placeholderTextColor={appTheme.disabled}
              onSubmitEditing={() => void sendMessage(input)}
              returnKeyType="send"
            />
            <TouchableOpacity
              activeOpacity={0.82}
              disabled={!input.trim() || busy}
              onPress={() => void sendMessage(input)}
              style={[styles.sendBtn, { backgroundColor: input.trim() && !busy ? NAVY : appTheme.border }]}
            >
              <ArrowRight color={input.trim() && !busy ? '#FFFFFF' : appTheme.muted} size={16} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Complete footer */}
        {isComplete ? (
          <View style={[styles.completeBar, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: appTheme.darkMode ? appTheme.successSoft : '#F0FDF4', borderTopColor: appTheme.border }]}>
            <TouchableOpacity activeOpacity={0.85} onPress={onClose} style={styles.completeBtn}>
              <Check color="#FFFFFF" size={15} />
              <Typography variant="body" color="#FFFFFF" style={styles.completeText}>
                Profile Complete — Apply Context
              </Typography>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '800' },
  headerSubtitle: {
    flexShrink: 1,
    lineHeight: 17,
  },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBlock: { marginTop: 12 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressPct: { fontWeight: '800' },
  progressTrack: {
    height: 5,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  reviewBtn: {
    marginTop: 8,
    width: '100%',
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  body: { flex: 1 },
  bodyContent: {
    padding: Theme.spacing.lg,
    gap: 14,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
    gap: 14,
    paddingVertical: 48,
  },
  emptyLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.large,
  },
  emptyTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: NAVY,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 13,
    ...Theme.shadows.medium,
  },
  startBtnText: { fontWeight: '700' },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: NAVY,
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBubble: {
    flex: 1,
    borderRadius: 18,
    borderTopLeftRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingBubble: {
    flex: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  bubbleText: { lineHeight: 20 },
  cardBox: {
    borderWidth: 1.5,
    borderRadius: 15,
    padding: Theme.spacing.md,
    ...Theme.shadows.small,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardLabel: { fontWeight: '800', flex: 1 },
  cardTextInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
  },
  cardTextArea: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingBottom: 40,
  },
  suggestBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  suggestText: { fontWeight: '700' },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  radioColumn: { gap: 7 },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  radioDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontWeight: '700' },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  hoursCol: { flex: 1, gap: 4 },
  hoursDash: { marginBottom: 10 },
  cardSubmit: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cardSubmitText: { fontWeight: '800' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 10,
    borderTopWidth: 1.5,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 13.5,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBar: {
    paddingHorizontal: Theme.spacing.md,
    paddingTop: 10,
    borderTopWidth: 1.5,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 11,
    paddingVertical: 12,
    ...Theme.shadows.medium,
  },
  completeText: { fontWeight: '800' },
});
