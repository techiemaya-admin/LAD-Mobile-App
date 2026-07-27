import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import {
  BarChart3,
  Download,
  Filter,
  Layers,
  PieChart,
  RefreshCw,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonBlock } from '@/components/ui/SkeletonLoader';
import { useAppTheme } from '@/src/theme/appTheme';
import { exportXlsxRowsFile } from '@/src/utils/fileExport';
import {
  FUNNEL_PERIODS,
  FUNNEL_STAGES,
  fetchSalesFunnel,
  type FunnelLead,
  type FunnelPeriodKey,
  type FunnelStageKey,
  type SalesFunnelData,
} from '@/src/services/salesFunnel';

/**
 * SalesFunnelSection — mobile port of LAD-Frontend-2's overview
 * CombinedFunnelWidget. One cross-channel lead funnel: New Leads → Accepted →
 * Responded → Meeting Booked (SAH), date-windowed by a Week / Month / Quarter /
 * Year selector (default Week), with three switchable views: vertical funnel
 * bars, a horizontal stacked bar, and a donut (pie) of each stage's share of
 * the total pipeline. Tapping a stage (bar, segment, slice or legend row)
 * opens a bottom sheet listing that stage's leads with LinkedIn links and CSV
 * export.
 */

const FUNNEL_ACCENT = '#0F6E56';

type ViewModeKey = 'funnel' | 'stack' | 'pie';
const VIEW_MODES: { key: ViewModeKey; label: string; icon: LucideIcon }[] = [
  { key: 'funnel', label: 'Funnel', icon: BarChart3 },
  { key: 'stack', label: 'Stack', icon: Layers },
  { key: 'pie', label: 'Pie', icon: PieChart },
];

const num = (n: number) => n.toLocaleString();
const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const fmtFollowup = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const buildLeadsRows = (leads: FunnelLead[]) => [
  ['Name', 'Company', 'Industry', 'Campaign', 'LinkedIn URL', 'Next follow-up'],
  ...leads.map((lead) => [
    lead.name,
    lead.company_name || '',
    lead.industry || '',
    lead.campaign_name || '',
    lead.linkedin_url || '',
    lead.next_followup_at ? new Date(lead.next_followup_at).toISOString() : '',
  ]),
];

const exportLeadsCsv = async (leads: FunnelLead[], fileLabel: string) => {
  const fileName = `leads-${fileLabel}.xlsx`;
  return exportXlsxRowsFile(fileName, 'Funnel Leads', buildLeadsRows(leads), 'Save funnel leads Excel file');
};

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const donutSlicePath = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
) => {
  const largeArc = end - start > Math.PI ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, start);
  const o2 = polar(cx, cy, rOuter, end);
  const i1 = polar(cx, cy, rInner, end);
  const i2 = polar(cx, cy, rInner, start);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
};

export function SalesFunnelSection({ refreshedAt }: { refreshedAt?: string }) {
  const appTheme = useAppTheme();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<FunnelPeriodKey>('week');
  const [viewMode, setViewMode] = useState<ViewModeKey>('pie');
  const [data, setData] = useState<SalesFunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStage, setOpenStage] = useState<FunnelStageKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSalesFunnel(period));
    } catch (e) {
      setError(e instanceof Error && e.message.length < 120 ? e.message : 'Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load, refreshedAt]);

  useEffect(() => {
    setOpenStage(null);
  }, [period]);

  useEffect(() => {
    setExportNotice(null);
  }, [openStage]);

  const first = data?.counts.sent ?? 0;
  const last = data?.counts.sah ?? 0;
  const overall = rate(last, first);
  const total = FUNNEL_STAGES.reduce((sum, s) => sum + (data?.counts[s.key] ?? 0), 0);
  const maxCount = Math.max(1, ...FUNNEL_STAGES.map((s) => data?.counts[s.key] ?? 0));
  const periodLabel = FUNNEL_PERIODS.find((p) => p.key === period)?.label ?? '';
  const isEmpty = Boolean(data) && total === 0;
  const openStageInfo = openStage ? FUNNEL_STAGES.find((s) => s.key === openStage) : null;
  const isWide = width >= 700;
  const pieSize = Math.max(190, Math.min(220, width - 124));

  const shares = useMemo(
    () =>
      FUNNEL_STAGES.map((s) => {
        const count = data?.counts[s.key] ?? 0;
        return { ...s, count, share: total > 0 ? count / total : 0 };
      }),
    [data, total],
  );

  const legend = (
    <View style={styles.legend}>
      <Typography variant="overline" color={appTheme.muted} style={styles.legendTitle}>
        Stages share ratio
      </Typography>
      {shares.map((s) => (
        <TouchableOpacity
          key={s.key}
          activeOpacity={0.7}
          onPress={() => setOpenStage(s.key)}
          style={[styles.legendRow, { borderColor: appTheme.borderSoft }]}
        >
          <View style={styles.legendNameGroup}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text
              style={[styles.legendLabel, { color: appTheme.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {s.label}
            </Text>
          </View>
          <View style={styles.legendMetricGroup}>
            <Typography variant="bodySmall" color={appTheme.text} style={styles.legendCount}>
              {num(s.count)}
            </Typography>
            <Typography variant="caption" color={appTheme.muted} style={styles.legendShare}>
              ({Math.round(s.share * 100)}%)
            </Typography>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPie = () => {
    const size = pieSize;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = (size / 2) - 6;
    const rInner = Math.max(54, rOuter * 0.6);
    const visible = shares.filter((s) => s.count > 0);
    const gap = visible.length > 1 ? 0.03 : 0;
    let angle = -Math.PI / 2;

    return (
      <View style={[styles.pieLayout, isWide && styles.pieLayoutWide]}>
        <View style={[styles.pieChartBox, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            {visible.length === 1 ? (
              <Circle
                cx={cx}
                cy={cy}
                r={(rOuter + rInner) / 2}
                stroke={visible[0].color}
                strokeWidth={rOuter - rInner}
                fill="none"
                onPress={() => setOpenStage(visible[0].key)}
              />
            ) : (
              visible.map((s) => {
                const sweep = s.share * Math.PI * 2;
                const start = angle + gap / 2;
                const end = angle + sweep - gap / 2;
                angle += sweep;
                const mid = (start + end) / 2;
                const labelPos = polar(cx, cy, (rOuter + rInner) / 2, mid);
                return (
                  <React.Fragment key={s.key}>
                    <Path
                      d={donutSlicePath(cx, cy, rOuter, rInner, start, Math.max(end, start + 0.01))}
                      fill={s.color}
                      onPress={() => setOpenStage(s.key)}
                    />
                    {s.share >= 0.12 && (
                      <SvgText
                        x={labelPos.x}
                        y={labelPos.y + 4}
                        fill="#FFFFFF"
                        fontSize={11}
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {`${Math.round(s.share * 100)}%`}
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </Svg>
          <View style={styles.pieCenter} pointerEvents="none">
            <Typography variant="overline" color={appTheme.muted}>Total pipeline</Typography>
            <Typography variant="h2" color={appTheme.text} style={styles.pieCenterValue}>
              {num(total)}
            </Typography>
            <Typography variant="caption" color={appTheme.muted}>leads logged</Typography>
          </View>
        </View>
        <View style={isWide ? styles.legendWide : styles.legendCompact}>{legend}</View>
      </View>
    );
  };

  const renderStack = () => (
    <View>
      <View style={[styles.stackBar, { backgroundColor: appTheme.softSurface }]}>
        {shares.filter((s) => s.count > 0).map((s) => (
          <TouchableOpacity
            key={s.key}
            activeOpacity={0.75}
            onPress={() => setOpenStage(s.key)}
            style={{ width: `${Math.round(s.share * 100)}%`, backgroundColor: s.color }}
          />
        ))}
      </View>
      {legend}
    </View>
  );

  const renderFunnel = () => (
    <View style={styles.funnel}>
      {shares.map((s, i) => {
        const w = Math.max(24, Math.round((s.count / maxCount) * 100));
        const prev = i > 0 ? shares[i - 1].count : null;
        const conv = prev != null && prev > 0 ? rate(s.count, prev) : null;
        const dropped = prev != null ? Math.max(0, prev - s.count) : 0;
        return (
          <View key={s.key}>
            {i > 0 && (
              <View style={styles.convRow}>
                <View style={[styles.convPill, { backgroundColor: appTheme.softSurface }]}>
                  <Typography variant="caption" color={appTheme.muted} style={styles.convText}>
                    {conv != null ? `${conv}%` : '—'}
                  </Typography>
                </View>
                {dropped > 0 && (
                  <Typography variant="caption" color={appTheme.disabled}>
                    {num(dropped)} dropped
                  </Typography>
                )}
              </View>
            )}
            <View style={styles.stageRow}>
              <Typography variant="caption" color={appTheme.text} style={styles.stageLabel} numberOfLines={2}>
                {s.label}
              </Typography>
              <View style={styles.barArea}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setOpenStage(s.key)}
                  style={[styles.bar, { width: `${w}%`, backgroundColor: s.color }]}
                >
                  <Typography variant="bodySmall" color="#FFFFFF" style={styles.barCount} numberOfLines={1}>
                    {num(s.count)}
                  </Typography>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <GlassCard style={[styles.card, { borderColor: appTheme.borderSoft }]}>
        {loading && !data ? (
          /* Full-card shimmer skeleton, matching the other home sections */
          <View style={skeletonStyles.skeletonBox}>
            <View style={skeletonStyles.skeletonHeaderRow}>
              <SkeletonBlock style={skeletonStyles.skeletonIcon} borderRadius={11} />
              <View style={skeletonStyles.skeletonHeaderText}>
                <SkeletonBlock style={skeletonStyles.skeletonLineWide} borderRadius={6} />
                <SkeletonBlock style={skeletonStyles.skeletonLineNarrow} borderRadius={6} />
              </View>
              <SkeletonBlock style={skeletonStyles.skeletonRefresh} borderRadius={10} />
            </View>
            <SkeletonBlock style={skeletonStyles.skeletonSwitcher} borderRadius={12} />
            <View style={skeletonStyles.skeletonPillRow}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} style={skeletonStyles.skeletonPill} borderRadius={999} />
              ))}
            </View>
            <View style={skeletonStyles.skeletonSummary}>
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} style={skeletonStyles.skeletonSummaryItem} borderRadius={12} />
              ))}
            </View>
            <SkeletonBlock style={skeletonStyles.skeletonChart} borderRadius={100} />
            <View style={skeletonStyles.skeletonLegend}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} style={skeletonStyles.skeletonLegendRow} borderRadius={10} />
              ))}
            </View>
          </View>
        ) : (
        <>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconShell, { backgroundColor: `${FUNNEL_ACCENT}16` }]}>
            <Filter color={FUNNEL_ACCENT} size={19} />
          </View>
          <View style={styles.headerText}>
            <Typography variant="h4" color={appTheme.text}>Sales Funnel</Typography>
            <Typography variant="caption" color={appTheme.muted}>Cross-channel lead journey</Typography>
          </View>
          <TouchableOpacity
            onPress={() => void load()}
            disabled={loading}
            style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={appTheme.muted} />
            ) : (
              <RefreshCw color={appTheme.muted} size={16} />
            )}
          </TouchableOpacity>
        </View>

        {/* View mode switcher */}
        <View style={[styles.viewSwitcher, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
          {VIEW_MODES.map((mode) => {
            const isActive = viewMode === mode.key;
            const ModeIcon = mode.icon;
            return (
              <TouchableOpacity
                key={mode.key}
                activeOpacity={0.8}
                onPress={() => setViewMode(mode.key)}
                style={[styles.viewTab, isActive && { backgroundColor: FUNNEL_ACCENT }]}
              >
                <ModeIcon color={isActive ? Theme.colors.surface : appTheme.muted} size={14} />
                <Typography
                  variant="caption"
                  color={isActive ? Theme.colors.surface : appTheme.muted}
                  style={styles.viewTabLabel}
                >
                  {mode.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Period pills */}
        <View style={styles.periodRow}>
          {FUNNEL_PERIODS.map((p) => {
            const isActive = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                activeOpacity={0.8}
                onPress={() => setPeriod(p.key)}
                style={[
                  styles.periodPill,
                  isActive
                    ? { backgroundColor: FUNNEL_ACCENT, borderColor: FUNNEL_ACCENT }
                    : { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft },
                ]}
              >
                <Typography
                  variant="caption"
                  color={isActive ? Theme.colors.surface : appTheme.muted}
                  style={styles.periodLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {p.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {error && !data ? (
          <View style={styles.stateBox}>
            <Typography variant="bodySmall" color={appTheme.text}>Could not load funnel</Typography>
            <Typography variant="caption" color={appTheme.muted} align="center" style={styles.stateDetail}>
              {error}
            </Typography>
            <TouchableOpacity onPress={() => void load()}>
              <Typography variant="caption" color={appTheme.primaryAccent} style={styles.retryLabel}>
                Try again
              </Typography>
            </TouchableOpacity>
          </View>
        ) : isEmpty ? (
          <View style={styles.stateBox}>
            <Typography variant="bodySmall" color={appTheme.text}>No activity in this period</Typography>
            <Typography variant="caption" color={appTheme.muted} align="center" style={styles.stateDetail}>
              Try a wider time range, or wait for your campaigns to send connection requests.
            </Typography>
          </View>
        ) : data ? (
          <View>
            {/* Summary row: New Leads · Overall conversion · Won (SAH) */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryBox, { borderColor: appTheme.borderSoft }]}>
                <Typography variant="overline" color={appTheme.muted}>New Leads</Typography>
                <Typography variant="h3" color={appTheme.text}>{num(first)}</Typography>
              </View>
              <View style={[styles.summaryCenter, { borderColor: appTheme.borderSoft }]}>
                <Typography variant="overline" color={appTheme.muted} align="center">Overall conversion</Typography>
                <Typography variant="h2" color={FUNNEL_ACCENT} style={styles.overallValue}>
                  {overall}%
                </Typography>
              </View>
              <View style={[styles.summaryBox, { borderColor: appTheme.successSoft, backgroundColor: appTheme.successSoft }]}>
                <Typography variant="overline" color={appTheme.muted}>Won (SAH)</Typography>
                <Typography variant="h3" color={appTheme.success}>{num(last)}</Typography>
              </View>
            </View>

            {viewMode === 'pie' ? renderPie() : viewMode === 'stack' ? renderStack() : renderFunnel()}

            <Typography variant="caption" color={appTheme.disabled} align="center" style={styles.hint}>
              Tap any stage segment or label to view its lead entries.
            </Typography>
          </View>
        ) : null}
        </>
        )}
      </GlassCard>

      {/* Stage leads drill-down sheet */}
      <Modal
        visible={Boolean(openStage && data)}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenStage(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setOpenStage(null)} />
          <View style={[styles.sheet, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: appTheme.borderSoft }]}>
              <View style={styles.sheetHeaderText}>
                <Typography variant="h4" color={appTheme.text}>{openStageInfo?.label ?? ''}</Typography>
                <Typography variant="caption" color={appTheme.muted}>
                  {openStage && data
                    ? `${periodLabel} · ${num(data.counts[openStage])} lead${data.counts[openStage] === 1 ? '' : 's'}`
                    : ''}
                </Typography>
              </View>
              <TouchableOpacity
                disabled={exporting || !openStage || !data || data.lists[openStage].length === 0}
                onPress={async () => {
                  if (!openStage || !data || !openStageInfo) return;
                  setExporting(true);
                  try {
                    const result = await exportLeadsCsv(
                      data.lists[openStage],
                      `${openStageInfo.label.replace(/\s+/g, '-').toLowerCase()}-${period}`,
                    );
                    setExportNotice(result?.message ?? 'Excel export is ready.');
                  } catch {
                    setExportNotice('Could not prepare the Excel export. Please try again.');
                  } finally {
                    setExporting(false);
                  }
                }}
                style={[
                  styles.sheetAction,
                  { borderColor: appTheme.borderSoft },
                  (exporting || !openStage || !data || data.lists[openStage].length === 0) && styles.sheetActionDisabled,
                ]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={appTheme.muted} />
                ) : (
                  <Download color={appTheme.text} size={15} />
                )}
                <Typography variant="caption" color={appTheme.text} style={styles.sheetActionLabel}>XLSX</Typography>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpenStage(null)} style={styles.sheetClose}>
                <X color={appTheme.muted} size={20} />
              </TouchableOpacity>
            </View>

            {exportNotice ? (
              <View style={[styles.exportNotice, { backgroundColor: appTheme.successSoft, borderBottomColor: appTheme.borderSoft }]}>
                <Typography variant="caption" color={appTheme.success} style={styles.exportNoticeText}>
                  {exportNotice}
                </Typography>
              </View>
            ) : null}

            {openStage && data && data.lists[openStage].length === 0 ? (
              <View style={styles.stateBox}>
                <Typography variant="bodySmall" color={appTheme.muted} align="center">
                  No leads in this stage for the selected period.
                </Typography>
              </View>
            ) : openStage && data ? (
              <FlatList
                data={data.lists[openStage]}
                keyExtractor={(item, index) => `${item.lead_id}-${item.campaign_name}-${index}`}
                contentContainerStyle={styles.leadList}
                renderItem={({ item }) => {
                  const followup = fmtFollowup(item.next_followup_at);
                  return (
                    <View style={[styles.leadRow, { borderBottomColor: appTheme.borderSoft }]}>
                      <View style={styles.leadMain}>
                        <View style={styles.leadNameRow}>
                          <Typography
                            variant="bodySmall"
                            color={appTheme.text}
                            style={styles.leadName}
                            numberOfLines={1}
                          >
                            {item.name || 'Unknown'}
                          </Typography>
                          {item.linkedin_url ? (
                            <TouchableOpacity
                              onPress={() => void Linking.openURL(item.linkedin_url!)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <FontAwesome5 name="linkedin" color="#0077B5" size={15} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <Typography variant="caption" color={appTheme.muted} numberOfLines={1}>
                          {[item.company_name, item.campaign_name].filter(Boolean).join(' · ') || '—'}
                        </Typography>
                      </View>
                      {followup ? (
                        <View style={styles.leadFollowup}>
                          <Typography variant="caption" color={appTheme.disabled}>Follow-up</Typography>
                          <Typography variant="caption" color={appTheme.muted}>{followup}</Typography>
                        </View>
                      ) : null}
                    </View>
                  );
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  skeletonBox: {
    gap: Theme.spacing.md,
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  skeletonIcon: {
    width: 38,
    height: 38,
  },
  skeletonHeaderText: {
    flex: 1,
    gap: 6,
  },
  skeletonLineWide: {
    width: 130,
    height: 14,
  },
  skeletonLineNarrow: {
    width: 170,
    height: 10,
  },
  skeletonRefresh: {
    width: 32,
    height: 32,
  },
  skeletonSwitcher: {
    height: 38,
    width: '100%',
  },
  skeletonPillRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  skeletonPill: {
    width: 72,
    height: 30,
  },
  skeletonSummary: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  skeletonSummaryItem: {
    flex: 1,
    height: 64,
  },
  skeletonChart: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginVertical: Theme.spacing.sm,
  },
  skeletonLegend: {
    gap: Theme.spacing.sm,
  },
  skeletonLegendRow: {
    height: 34,
    width: '100%',
  },
});

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.xxl,
  },
  card: {
    borderWidth: 1,
    padding: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  iconShell: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSwitcher: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Theme.spacing.md,
    gap: 2,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  viewTabLabel: {
    fontWeight: '600',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Theme.spacing.lg,
  },
  periodPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  periodLabel: {
    fontWeight: '600',
    fontSize: 12,
  },
  stateBox: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.lg,
    gap: 4,
  },
  stateDetail: {
    maxWidth: 260,
  },
  retryLabel: {
    fontWeight: '600',
    marginTop: Theme.spacing.xs,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.xl,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    alignItems: 'center',
    minWidth: 86,
    gap: 2,
  },
  summaryCenter: {
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    minWidth: 102,
    gap: 2,
  },
  overallValue: {
    fontWeight: '800',
  },
  pieLayout: {
    alignItems: 'center',
    gap: Theme.spacing.lg,
    width: '100%',
  },
  pieLayoutWide: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.xxl,
  },
  pieChartBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieCenter: {
    position: 'absolute',
    alignItems: 'center',
    gap: 1,
  },
  pieCenterValue: {
    fontWeight: '800',
  },
  legendWide: {
    flex: 1,
    maxWidth: 300,
  },
  legendCompact: {
    width: '100%',
    maxWidth: 272,
    alignSelf: 'center',
  },
  legend: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 8,
    marginTop: Theme.spacing.md,
  },
  legendTitle: {
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    width: '100%',
    gap: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    minHeight: 48,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legendNameGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
    lineHeight: 18,
    includeFontPadding: false,
  },
  legendMetricGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    width: 86,
    flexShrink: 0,
  },
  legendCount: {
    fontWeight: '700',
    minWidth: 26,
    textAlign: 'right',
  },
  legendShare: {
    minWidth: 46,
    textAlign: 'right',
  },
  stackBar: {
    flexDirection: 'row',
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
  },
  funnel: {
    gap: 4,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: 2,
  },
  convPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  convText: {
    fontWeight: '600',
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  stageLabel: {
    width: 88,
    flexShrink: 0,
    fontWeight: '600',
  },
  barArea: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  barCount: {
    fontWeight: '700',
  },
  hint: {
    marginTop: Theme.spacing.lg,
    maxWidth: 320,
    alignSelf: 'center',
    lineHeight: 18,
    paddingBottom: Theme.spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '85%',
    minHeight: '45%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sheetActionDisabled: {
    opacity: 0.4,
  },
  sheetActionLabel: {
    fontWeight: '600',
  },
  sheetClose: {
    padding: 6,
  },
  leadList: {
    paddingBottom: Theme.spacing.xxl,
  },
  exportNotice: {
    borderBottomWidth: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: 9,
  },
  exportNoticeText: {
    fontWeight: '700',
    lineHeight: 17,
  },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  leadMain: {
    flex: 1,
    gap: 2,
  },
  leadNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadName: {
    fontWeight: '600',
    flexShrink: 1,
  },
  leadFollowup: {
    alignItems: 'flex-end',
    gap: 1,
    flexShrink: 0,
  },
});
