import React from 'react';
import { View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { TrendingUp, Users, Target, Activity } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedScreen } from '@/components/ui/AnimatedScreen';

export default function AnalyticsScreen() {
  const handleBottomTabScroll = useBottomTabScrollHandler();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const columns = isDesktop ? 4 : isTablet ? 3 : 2;
  const containerPadding = 24; // Theme.spacing.xl
  const gap = 16; // Theme.spacing.md
  
  // Calculate exact card width considering gaps and padding
  const availableWidth = Math.min(width, 1200) - (containerPadding * 2);
  const cardWidth = (availableWidth - (gap * (columns - 1))) / columns;

  return (
    <AnimatedScreen style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
        <View style={styles.contentMaxWidth}>
          <Typography variant="h1">Analytics</Typography>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.contentMaxWidth}>
          <View style={styles.grid}>
            <GlassCard style={[styles.gridCard, { width: cardWidth }]}>
            <View style={styles.iconContainer}>
              <TrendingUp color={Theme.colors.surface} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>$124K</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>Total Revenue</Typography>
          </GlassCard>
          
          <GlassCard style={[styles.gridCard, { width: cardWidth }]}>
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.successLight }]}>
              <Users color={Theme.colors.success} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>1,432</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>New Leads</Typography>
          </GlassCard>

          <GlassCard style={[styles.gridCard, { width: cardWidth }]}>
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.warningLight }]}>
              <Target color={Theme.colors.warning} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>24.5%</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>Conversion Rate</Typography>
          </GlassCard>

          <GlassCard style={[styles.gridCard, { width: cardWidth }]}>
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.infoLight }]}>
              <Activity color={Theme.colors.info} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>892</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>Active Campaigns</Typography>
          </GlassCard>
        </View>

        <Typography variant="h4" style={styles.sectionTitle}>Performance Overview</Typography>
        <GlassCard style={styles.chartCard}>
          <View style={styles.chartPlaceholder}>
            <Typography variant="body" color={Theme.colors.textDisabled}>Chart visualization goes here</Typography>
          </View>
        </GlassCard>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  contentMaxWidth: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  gridCard: {
    padding: Theme.spacing.lg,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: Theme.spacing.md,
  },
  chartCard: {
    padding: Theme.spacing.md,
    height: 250,
  },
  chartPlaceholder: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    borderStyle: 'dashed',
  },
});
