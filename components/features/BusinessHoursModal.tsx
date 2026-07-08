import React, { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Clock, ClipboardList, ChevronDown, Check } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';

export interface BusinessHoursPayload {
  startTime: string;
  endTime: string;
  timezone: string;
  activeDays: number[];
}

interface BusinessHoursModalProps {
  visible: boolean;
  initialData?: BusinessHoursPayload;
  onSave: (payload: BusinessHoursPayload, summary: string) => void;
  onClose: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const timezoneOptions = [
  { value: 'UTC+0', label: 'UTC — Coordinated Universal Time (UTC+0)', short: 'UTC(UTC+0)' },
  { value: 'GMT+0', label: 'GMT — Greenwich Mean Time (UTC+0)', short: 'GMT(UTC+0)' },
  { value: 'GST+4', label: 'GST — Gulf Standard Time (UTC+4)', short: 'GST(UTC+4)' },
  { value: 'IST+5:30', label: 'IST — India Standard Time (UTC+5:30)', short: 'IST(UTC+5:30)' },
  { value: 'EST-5', label: 'EST — Eastern Standard Time (UTC−5)', short: 'EST(UTC-5)' },
  { value: 'PST-8', label: 'PST — Pacific Standard Time (UTC−8)', short: 'PST(UTC-8)' },
  { value: 'CET+1', label: 'CET — Central European Time (UTC+1)', short: 'CET(UTC+1)' },
  { value: 'JST+9', label: 'JST — Japan Standard Time (UTC+9)', short: 'JST(UTC+9)' },
  { value: 'AEST+10', label: 'AEST — Australian Eastern Time (UTC+10)', short: 'AEST(UTC+10)' },
];

export const BusinessHoursModal: React.FC<BusinessHoursModalProps> = ({
  visible,
  initialData,
  onSave,
  onClose,
}) => {
  const appTheme = useAppTheme();
  
  // Premium tint for accents: Indigo in dark mode, Navy in light mode
  const brandColor = appTheme.darkMode ? '#818CF8' : '#0B1957';
  const brandSoft = appTheme.darkMode ? 'rgba(129, 140, 248, 0.15)' : 'rgba(11, 25, 87, 0.08)';
  const [startTime, setStartTime] = useState(initialData?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initialData?.endTime ?? '18:00');
  const [timezone, setTimezone] = useState(initialData?.timezone ?? 'GST+4');
  const [activeDays, setActiveDays] = useState<number[]>(initialData?.activeDays ?? [0, 1, 2, 3, 4]);

  const [pickingTime, setPickingTime] = useState<'start' | 'end' | null>(null);
  const [pickingTimezone, setPickingTimezone] = useState(false);

  const toggleDay = (i: number) => {
    setActiveDays(prev =>
      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort((a, b) => a - b)
    );
  };

  const applyPreset = (type: 'weekdays' | 'all' | 'weekend' | 'custom') => {
    if (type === 'weekdays') setActiveDays([0, 1, 2, 3, 4]);
    else if (type === 'all') setActiveDays([0, 1, 2, 3, 4, 5, 6]);
    else if (type === 'weekend') setActiveDays([5, 6]);
    else setActiveDays([]);
  };

  const getPreset = () => {
    const s = JSON.stringify([...activeDays].sort((a, b) => a - b));
    if (s === JSON.stringify([0, 1, 2, 3, 4])) return 'weekdays';
    if (s === JSON.stringify([0, 1, 2, 3, 4, 5, 6])) return 'all';
    if (s === JSON.stringify([5, 6])) return 'weekend';
    return 'custom';
  };

  const currentPreset = getPreset();

  const getDayHint = () => {
    const sorted = [...activeDays].sort((a, b) => a - b);
    if (!sorted.length) return 'No days selected';
    if (sorted.length === 7) return 'All 7 days selected';
    if (JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3, 4])) return 'Mon – Fri selected';
    if (JSON.stringify(sorted) === JSON.stringify([5, 6])) return 'Sat – Sun selected';
    return sorted.map(i => DAYS[i]).join(', ') + ' selected';
  };

  const fmt12 = (val: string) => {
    if (!val) return '12:00 AM';
    const [hStr, mStr] = val.split(':');
    const h = Number(hStr) || 0;
    const m = Number(mStr) || 0;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const getSummary = () => {
    const tzText = timezoneOptions.find(o => o.value === timezone)?.short ?? '';
    const sorted = [...activeDays].sort((a, b) => a - b);
    let dayStr = 'No days';
    if (sorted.length === 7) dayStr = 'All Days';
    else if (JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3, 4])) dayStr = 'Mon–Fri';
    else if (JSON.stringify(sorted) === JSON.stringify([5, 6])) dayStr = 'Sat–Sun';
    else dayStr = sorted.map(i => DAYS[i]).join(', ');
    return `${fmt12(startTime)} – ${fmt12(endTime)} · ${dayStr} · ${tzText}`;
  };

  const PRESET_LABELS: Record<string, string> = {
    weekdays: 'Weekdays', all: 'All Days', weekend: 'Weekends', custom: 'Custom',
  };

  const timeOptions = Array.from({ length: 48 }).map((_, i) => {
    const hr = Math.floor(i / 2);
    const min = i % 2 === 0 ? '00' : '30';
    const ampm = hr < 12 ? 'AM' : 'PM';
    const displayH = String(hr % 12 || 12).padStart(2, '0');
    return {
      val: `${String(hr).padStart(2, '0')}:${min}`,
      label: `${displayH}:${min} ${ampm}`
    };
  });

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Theme.spacing.md,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 560,
      backgroundColor: appTheme.surface,
      borderRadius: 16,
      overflow: 'hidden',
      maxHeight: '90%',
    },
    topAccent: {
      height: 3,
      backgroundColor: brandColor,
      width: '100%',
    },
    content: {
      padding: 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    headerTextContainer: {
      flex: 1,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      color: appTheme.muted,
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 24,
      gap: 12,
    },
    timeBlock: {
      flex: 1,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: appTheme.muted,
      marginBottom: 6,
    },
    selectBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: appTheme.border,
      backgroundColor: appTheme.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    divider: {
      height: 1,
      backgroundColor: appTheme.borderSoft,
      marginBottom: 24,
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    presetButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: appTheme.border,
      backgroundColor: appTheme.surface,
    },
    presetButtonActive: {
      borderColor: brandColor,
      backgroundColor: brandSoft,
    },
    daysGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 8,
    },
    dayBox: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: appTheme.border,
      backgroundColor: appTheme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBoxActive: {
      borderColor: brandColor,
      backgroundColor: brandSoft,
    },
    dayIndicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 4,
    },
    summaryBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: brandSoft,
      borderWidth: 1,
      borderColor: brandSoft,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
    },
    saveButton: {
      backgroundColor: brandColor,
      paddingVertical: 14,

      borderRadius: 12,
      alignItems: 'center',
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'flex-end',
    },
    pickerContainer: {
      backgroundColor: appTheme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: 300,
    },
    pickerItem: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: appTheme.borderSoft,
    },
    pickerItemActive: {
      backgroundColor: brandSoft,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalContainer}>
          <View style={styles.topAccent} />
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconBox}>
                <Clock color={brandColor} size={20} />
              </View>
              <View style={styles.headerTextContainer}>
                <Typography variant="h2" color={appTheme.text} style={{ fontSize: 20, fontWeight: '700' }}>
                  Business Hours
                </Typography>
                <Typography variant="caption" color={appTheme.muted} style={{ marginTop: 2 }}>
                  Configure availability & timezone
                </Typography>
              </View>
            </View>

            {/* Operating Hours */}
            <Typography style={styles.sectionLabel}>Operating Hours</Typography>
            <View style={styles.row}>
              <View style={styles.timeBlock}>
                <Typography style={styles.inputLabel}>Start Time</Typography>
                <TouchableOpacity style={styles.selectBox} onPress={() => setPickingTime('start')}>
                  <Typography variant="bodySmall" color={appTheme.text}>{fmt12(startTime)}</Typography>
                  <Clock color={appTheme.muted} size={14} />
                </TouchableOpacity>
              </View>
              <View style={styles.timeBlock}>
                <Typography style={styles.inputLabel}>End Time</Typography>
                <TouchableOpacity style={styles.selectBox} onPress={() => setPickingTime('end')}>
                  <Typography variant="bodySmall" color={appTheme.text}>{fmt12(endTime)}</Typography>
                  <Clock color={appTheme.muted} size={14} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Timezone */}
            <Typography style={styles.sectionLabel}>Timezone</Typography>
            <View style={{ marginBottom: 24 }}>
              <TouchableOpacity style={styles.selectBox} onPress={() => setPickingTimezone(true)}>
                <Typography variant="bodySmall" color={appTheme.text} numberOfLines={1} style={{ flex: 1, marginRight: 8 }}>
                  {timezoneOptions.find(o => o.value === timezone)?.label ?? timezone}
                </Typography>
                <ChevronDown color={appTheme.muted} size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Active Days */}
            <Typography style={styles.sectionLabel}>Active Days</Typography>

            <View style={styles.presetsRow}>
              {(['weekdays', 'all', 'weekend', 'custom'] as const).map(preset => {
                const isActive = currentPreset === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetButton, isActive && styles.presetButtonActive]}
                    onPress={() => applyPreset(preset)}
                  >
                    <Typography
                      variant="caption"
                      color={isActive ? brandColor : appTheme.muted}
                      style={{ fontWeight: isActive ? '600' : '500' }}
                    >
                      {PRESET_LABELS[preset]}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.daysGrid}>
              {DAYS.map((d, i) => {
                const active = activeDays.includes(i);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayBox, active && styles.dayBoxActive]}
                    onPress={() => toggleDay(i)}
                  >
                    <Typography variant="caption" color={active ? brandColor : appTheme.muted} style={{ fontWeight: '600', fontSize: 11 }}>
                      {d}
                    </Typography>
                    <View style={[styles.dayIndicator, { backgroundColor: active ? brandColor : 'transparent' }]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Typography variant="caption" color={appTheme.muted} style={{ textAlign: 'center', marginBottom: 24 }}>
              {getDayHint()}
            </Typography>

            {/* Summary */}
            <View style={styles.summaryBox}>
              <ClipboardList color={appTheme.text} size={22} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Typography style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', color: appTheme.muted }}>
                  Schedule Summary
                </Typography>
                <Typography variant="bodySmall" color={appTheme.text} style={{ fontWeight: '600', marginTop: 2 }}>
                  {getSummary()}
                </Typography>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                onSave({ startTime, endTime, timezone, activeDays }, getSummary());
                onClose();
              }}
            >
              <Typography variant="body" color="#FFFFFF" style={{ fontWeight: '700' }}>
                Save Business Hours
              </Typography>
            </TouchableOpacity>

          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Select Picker Modals */}
      <Modal visible={!!pickingTime} transparent animationType="slide">
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setPickingTime(null)}>
          <View style={styles.pickerContainer}>
            <ScrollView>
              {timeOptions.map(o => (
                <TouchableOpacity
                  key={o.val}
                  style={[styles.pickerItem, (pickingTime === 'start' ? startTime : endTime) === o.val && styles.pickerItemActive]}
                  onPress={() => {
                    if (pickingTime === 'start') setStartTime(o.val);
                    else setEndTime(o.val);
                    setPickingTime(null);
                  }}
                >
                  <Typography variant="body" color={appTheme.text}>{o.label}</Typography>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={pickingTimezone} transparent animationType="slide">
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setPickingTimezone(false)}>
          <View style={styles.pickerContainer}>
            <ScrollView>
              {timezoneOptions.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.pickerItem, timezone === o.value && styles.pickerItemActive]}
                  onPress={() => {
                    setTimezone(o.value);
                    setPickingTimezone(false);
                  }}
                >
                  <Typography variant="body" color={appTheme.text}>{o.label}</Typography>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};
