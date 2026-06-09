import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp, Users, Target, Activity } from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useBottomTabScrollHandler } from '@/components/ui/BottomTabSelector';

export default function AnalyticsScreen() {
  const handleBottomTabScroll = useBottomTabScrollHandler();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h1">Analytics</Typography>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleBottomTabScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.grid}>
          <GlassCard style={styles.gridCard}>
            <View style={styles.iconContainer}>
              <TrendingUp color={Theme.colors.surface} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>$124K</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>Total Revenue</Typography>
          </GlassCard>
          
          <GlassCard style={styles.gridCard}>
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.successLight }]}>
              <Users color={Theme.colors.success} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>1,432</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>New Leads</Typography>
          </GlassCard>

          <GlassCard style={styles.gridCard}>
            <View style={[styles.iconContainer, { backgroundColor: Theme.colors.warningLight }]}>
              <Target color={Theme.colors.warning} size={20} />
            </View>
            <Typography variant="h3" style={{ marginTop: Theme.spacing.md }}>24.5%</Typography>
            <Typography variant="caption" color={Theme.colors.textSecondary}>Conversion Rate</Typography>
          </GlassCard>

          <GlassCard style={styles.gridCard}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    padding: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.md,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
    paddingTop: 0,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  gridCard: {
    flex: 1,
    minWidth: '45%',
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
