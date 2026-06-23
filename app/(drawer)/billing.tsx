import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BarChart3,
  Brain,
  Check,
  CreditCard,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react-native';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BillingOverview,
  BillingUsageAnalytics,
  createRechargeSession,
  createStripeCheckoutSession,
  CreditPackage,
  emptyBillingUsageAnalytics,
  getBillingOverview,
  getWalletUsageAnalytics,
} from '@/src/services/settingsHub';
import { useAppTheme } from '@/src/theme/appTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readScreenCache, writeScreenCache } from '@/src/utils/screenCache';

const VOICE_CALL_MINIMUM_CREDITS = 3;
const WEB_INPUT_RESET = Platform.OS === 'web' ? ({ outlineStyle: 'none', boxShadow: 'none' } as any) : null;

const PRESET_AMOUNTS = [
  { value: 99, credits: 1000, label: 'Starter' },
  { value: 199, credits: 3000, label: 'Professional' },
  { value: 499, credits: 12000, label: 'Business' },
  { value: 999, credits: 12000, label: 'Enterprise' },
];

const CREDIT_PRICING = [
  { title: 'Voice Calls', detail: 'Cartesia voice + analytics', cost: '3 cr/min', icon: 'phone' },
  { title: 'Premium Voice', detail: 'ElevenLabs voice + analytics', cost: '4 cr/min', icon: 'brain' },
  { title: 'Email + LinkedIn URL', detail: 'Per enriched lead', cost: '2 credits', icon: 'search' },
  { title: 'Phone Reveal', detail: 'Per phone number revealed', cost: '10 credits', icon: 'zap' },
  { title: 'Template Message', detail: 'Per saved template send', cost: '5 credits', icon: 'message' },
  { title: 'LinkedIn Connection', detail: 'Monthly connection fee', cost: '50 cr/mo', icon: 'linkedin' },
];
type BillingRange = '7d' | '30d' | '90d';
type BillingCache = {
  billing: BillingOverview;
  usage: BillingUsageAnalytics;
};
const getBillingCacheKey = (range: BillingRange) => `drawer.billing.${range}`;

const formatCredits = (value: number | undefined | null, maxDigits = 3) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return '0';
  }

  const fractionDigits = Number.isInteger(numeric) ? 0 : maxDigits;

  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatMoney = (value: number, currency = 'USD') => {
  const numeric = Number(value || 0);
  if (currency.toLowerCase() === 'credits') {
    return `${formatCredits(numeric)} credits`;
  }
  return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const getRedirectUrl = (result: 'success' | 'cancelled') => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?payment=${result}`;
  }

  return result === 'success'
    ? 'https://techiemaya.com/wallet/success'
    : 'https://techiemaya.com/wallet/cancel';
};

const getFeatureIconName = (icon: string, featureName = '') => {
  const value = `${icon} ${featureName}`.toLowerCase();
  if (value.includes('phone') || value.includes('call')) return 'phone';
  if (value.includes('search') || value.includes('lead') || value.includes('reveal')) return 'search';
  if (value.includes('brain') || value.includes('ai')) return 'brain';
  if (value.includes('message') || value.includes('whatsapp') || value.includes('template')) return 'message';
  if (value.includes('zap')) return 'zap';
  return 'bar';
};

const FeatureIcon = ({ icon, color, size = 20 }: { icon: string; color: string; size?: number }) => {
  switch (icon) {
    case 'phone':
      return <Phone color={color} size={size} />;
    case 'search':
      return <Search color={color} size={size} />;
    case 'brain':
      return <Brain color={color} size={size} />;
    case 'message':
      return <MessageCircle color={color} size={size} />;
    case 'zap':
      return <Zap color={color} size={size} />;
    default:
      return <BarChart3 color={color} size={size} />;
  }
};

export default function BillingScreen() {
  const appTheme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [billing, setBilling] = useState<BillingOverview | null>(() => readScreenCache<BillingCache>(getBillingCacheKey('30d'))?.value.billing ?? null);
  const [usage, setUsage] = useState<BillingUsageAnalytics>(() => readScreenCache<BillingCache>(getBillingCacheKey('30d'))?.value.usage ?? emptyBillingUsageAnalytics());
  const [selectedRange, setSelectedRange] = useState<BillingRange>('30d');
  const [loading, setLoading] = useState(() => !readScreenCache<BillingCache>(getBillingCacheKey('30d')));
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutId, setCheckoutId] = useState('');
  const [checkoutAmount, setCheckoutAmount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(99);
  const [customAmount, setCustomAmount] = useState('');

  const availableCredits = billing?.availableBalance ?? billing?.currentBalance ?? 0;
  const neededForVoiceCall = Math.max(0, VOICE_CALL_MINIMUM_CREDITS - availableCredits);
  const hasVoiceCallMinimum = neededForVoiceCall <= 0;
  const voiceProgress = Math.max(0, Math.min(100, (availableCredits / VOICE_CALL_MINIMUM_CREDITS) * 100));
  const selectedCheckoutAmount = customAmount.trim() ? Number.parseFloat(customAmount) : selectedAmount;
  const selectedPreset = PRESET_AMOUNTS.find((preset) => preset.value === selectedCheckoutAmount);
  const estimatedCheckoutCredits = selectedPreset?.credits || Math.max(0, Math.round((selectedCheckoutAmount || 0) * (1000 / 99)));

  const topFeature = usage.topFeatures[0];
  const maxDailyCredits = useMemo(
    () => Math.max(...usage.dailyUsage.map((item) => item.credits), 1),
    [usage.dailyUsage],
  );
  const viewportWidth = Math.max(width || 0, 320);
  const isCompact = viewportWidth < 380;
  const isNarrow = viewportWidth < 560;
  const isWide = viewportWidth >= 760;
  const isDesktop = viewportWidth >= 1024;
  const contentMaxWidth = isDesktop ? 1080 : 760;
  const contentPadding = isCompact ? Theme.spacing.md : isWide ? Theme.spacing.xxl : Theme.spacing.lg;
  const metricTileWidth = '48%';
  const summaryTileWidth = isNarrow ? '100%' : '31.5%';
  const pricingCardWidth = isWide ? '48.7%' : '100%';
  const presetCardWidth = isCompact ? '100%' : '48%';

  const loadBilling = useCallback(async (asRefresh = false, range: BillingRange = '30d') => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [overview, usageData] = await Promise.all([
        getBillingOverview(),
        getWalletUsageAnalytics(range).catch(() => null),
      ]);
      setBilling(overview);
      const nextUsage = usageData || overview.usageAnalytics || emptyBillingUsageAnalytics();
      setUsage(nextUsage);
      writeScreenCache(getBillingCacheKey(range), { billing: overview, usage: nextUsage });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load billing data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = readScreenCache<BillingCache>(getBillingCacheKey(selectedRange));
    if (cached) {
      setBilling(cached.value.billing);
      setUsage(cached.value.usage);
      setLoading(false);
      return;
    }

    void loadBilling(false, selectedRange);
  }, [loadBilling, selectedRange]);

  const handleRangeChange = (range: '7d' | '30d' | '90d') => {
    setSelectedRange(range);
  };

  const handleRecharge = async (pack: CreditPackage) => {
    setCheckoutId(pack.id);
    try {
      const url = await createRechargeSession(pack.id);
      if (!url) {
        Alert.alert('Checkout unavailable', 'The backend did not return a payment link.');
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Recharge failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setCheckoutId('');
    }
  };

  const handleProceedToPayment = async () => {
    const amount = Number(selectedCheckoutAmount || 0);
    if (!amount || amount <= 0) {
      Alert.alert('Add credits', 'Please select or enter a valid amount.');
      return;
    }

    setCheckoutAmount(amount);
    try {
      const checkout = await createStripeCheckoutSession({
        amount,
        successUrl: getRedirectUrl('success'),
        cancelUrl: getRedirectUrl('cancelled'),
        metadata: {
          credits: estimatedCheckoutCredits,
          source: 'lad-app-billing',
        },
      });

      if (!checkout.url) {
        Alert.alert('Checkout unavailable', 'The backend did not return a Stripe checkout link.');
        return;
      }

      setShowAddCreditsModal(false);
      await Linking.openURL(checkout.url);
    } catch (err) {
      Alert.alert('Add credits failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setCheckoutAmount(null);
    }
  };

  const handleSelectAmount = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const renderUsageFeature = (feature: BillingUsageAnalytics['topFeatures'][number], index: number) => {
    const iconName = getFeatureIconName(feature.icon, feature.featureName);
    const progress = Math.max(0, Math.min(100, feature.percentage || (usage.totalCreditsUsed ? (feature.totalCredits / usage.totalCreditsUsed) * 100 : 0)));

    return (
      <View key={`${feature.featureName}-${index}`} style={styles.usageFeatureItem}>
        <View style={styles.usageFeatureTop}>
          <View style={styles.usageFeatureLeft}>
            <View style={[styles.featureIconWrap, { backgroundColor: appTheme.successSoft }]}>
              <FeatureIcon icon={iconName} color={appTheme.primaryAccent} />
            </View>
            <View style={styles.usageFeatureText}>
              <Typography variant="bodyLarge" color={appTheme.text} style={styles.usageFeatureName} numberOfLines={1}>{feature.featureName}</Typography>
              <Typography variant="caption" color={appTheme.muted}>{formatCredits(feature.usageCount, 0)} uses</Typography>
            </View>
          </View>
          <View style={styles.usageFeatureValue}>
            <Typography variant="bodySmall" color={appTheme.text} style={styles.usageCredits}>{formatCredits(feature.totalCredits)} credits</Typography>
            <Typography variant="caption" color={appTheme.muted}>{Math.round(progress * 10) / 10}%</Typography>
          </View>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: appTheme.borderSoft }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: appTheme.primaryAccent }]} />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: appTheme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            maxWidth: contentMaxWidth,
            paddingHorizontal: contentPadding,
            paddingTop: Theme.spacing.lg,
            paddingBottom: insets.bottom + 40,
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadBilling(true, selectedRange)} tintColor={appTheme.primaryAccent} colors={[appTheme.primaryAccent]} />}
      >
        <View style={[styles.headerRow, isCompact && styles.headerRowCompact]}>
          <View style={styles.headerText}>
            <Typography variant="h2" color={appTheme.text} numberOfLines={2}>Billing & Plans</Typography>
            <Typography variant="bodySmall" color={appTheme.muted} numberOfLines={2}>Live credits, usage, and wallet checkout</Typography>
          </View>
          <TouchableOpacity style={[styles.refreshButton, { backgroundColor: appTheme.surface, borderColor: appTheme.border }]} onPress={() => loadBilling(true, selectedRange)} disabled={refreshing || loading}>
            {refreshing || loading ? <ActivityIndicator color={appTheme.primaryAccent} /> : <RefreshCw color={appTheme.primaryAccent} size={18} />}
          </TouchableOpacity>
        </View>

        {error ? (
          <GlassCard style={styles.messageCard}>
            <Typography variant="body" color={Theme.colors.error}>{error}</Typography>
          </GlassCard>
        ) : null}

        {loading ? (
          <ActivityIndicator color={appTheme.primaryAccent} style={styles.loader} />
        ) : (
          <>
            <GlassCard style={[styles.walletCard, isCompact && styles.walletCardCompact, { borderColor: appTheme.primaryAccent }]}>
              <View style={[styles.walletHeroBand, { backgroundColor: appTheme.darkMode ? '#172033' : '#F1F5FF' }]}>
                <View style={[styles.walletHeader, isNarrow && styles.walletHeaderStack]}>
                  <View style={[styles.walletTitleRow, isCompact && styles.walletTitleRowCompact]}>
                    <View style={[styles.walletIcon, { backgroundColor: appTheme.primaryAccent }]}>
                      <Wallet color={appTheme.darkMode ? Theme.colors.primaryDark : Theme.colors.surface} size={24} />
                    </View>
                    <View style={styles.walletTitleText}>
                      <Typography variant="caption" color={appTheme.primaryAccent} style={styles.overline}>WALLET BALANCE</Typography>
                      <Typography variant="h2" color={appTheme.text} style={styles.creditBalance}>{formatCredits(availableCredits)} credits</Typography>
                      <Typography variant="caption" color={appTheme.muted}>Available credits from backend wallet</Typography>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.addCreditsButton, isNarrow && styles.addCreditsButtonFull, { backgroundColor: appTheme.primaryAccent }]}
                    onPress={() => setShowAddCreditsModal(true)}
                    activeOpacity={0.82}
                  >
                    <Plus color={appTheme.darkMode ? Theme.colors.primaryDark : Theme.colors.surface} size={17} />
                    <Typography variant="bodySmall" style={[styles.addCreditsText, { color: appTheme.darkMode ? Theme.colors.primaryDark : Theme.colors.surface }]}>Add Credits</Typography>
                  </TouchableOpacity>
                </View>

                <View style={[styles.minimumMeterTrack, { backgroundColor: appTheme.borderSoft }]}>
                  <View
                    style={[
                      styles.minimumMeterFill,
                      {
                        width: `${voiceProgress}%`,
                        backgroundColor: hasVoiceCallMinimum ? Theme.colors.success : Theme.colors.error,
                      },
                    ]}
                  />
                </View>
                <View style={styles.minimumMeterLabels}>
                  <Typography variant="overline" color={appTheme.muted}>0 credits</Typography>
                  <Typography variant="overline" color={appTheme.muted}>{VOICE_CALL_MINIMUM_CREDITS} credits minimum</Typography>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: appTheme.borderSoft }]} />

              <View style={styles.metricGrid}>
                <View style={[styles.metricTile, { width: metricTileWidth, backgroundColor: appTheme.softSurface }]}>
                  <Typography variant="caption" color={appTheme.muted}>Reserved</Typography>
                  <Typography variant="h3" color={appTheme.text} numberOfLines={1}>{formatCredits(billing?.reservedBalance)}</Typography>
                </View>
                <View style={[styles.metricTile, { width: metricTileWidth, backgroundColor: appTheme.softSurface }]}>
                  <Typography variant="caption" color={appTheme.muted}>Used</Typography>
                  <Typography variant="h3" color={appTheme.text} numberOfLines={1}>{formatCredits(billing?.monthlyUsage)}</Typography>
                </View>
              </View>

              <View style={[styles.voiceMinimumBox, { backgroundColor: hasVoiceCallMinimum ? appTheme.successSoft : appTheme.errorSoft, borderColor: hasVoiceCallMinimum ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)' }]}>
                <View style={styles.voiceMinimumTop}>
                  <Phone color={hasVoiceCallMinimum ? Theme.colors.success : Theme.colors.error} size={18} />
                  <Typography variant="bodySmall" color={hasVoiceCallMinimum ? Theme.colors.success : Theme.colors.error} style={styles.voiceMinimumTitle}>
                    {hasVoiceCallMinimum ? 'Voice calls are ready' : 'Voice call credits needed'}
                  </Typography>
                </View>
                <Typography variant="caption" color={appTheme.text}>
                  Current balance: {formatCredits(availableCredits)} credits. Required minimum: {VOICE_CALL_MINIMUM_CREDITS} credits. Need at least {formatCredits(neededForVoiceCall)} more credits.
                </Typography>
              </View>

              <View style={styles.featureGrid}>
                <View style={[styles.featurePill, { backgroundColor: appTheme.softSurface }]}>
                  <Check color={Theme.colors.success} size={16} />
                  <Typography variant="bodySmall" color={appTheme.text} style={styles.featureText}>{formatCredits(billing?.monthlyUsage)} credits used</Typography>
                </View>
                <View style={[styles.featurePill, { backgroundColor: appTheme.softSurface }]}>
                  <Check color={Theme.colors.success} size={16} />
                  <Typography variant="bodySmall" color={appTheme.text} style={styles.featureText}>{billing?.planTier || 'starter'} plan, {billing?.status || 'active'} wallet</Typography>
                </View>
              </View>
            </GlassCard>

            <Typography variant="h4" color={appTheme.text} style={styles.sectionTitle}>Usage by Feature</Typography>
            <GlassCard style={[styles.usageCard, isCompact && styles.cardCompact]}>
              <View style={[styles.usageHeader, isNarrow && styles.usageHeaderStack]}>
                <View style={styles.usageHeaderText}>
                  <Typography variant="bodyLarge" color={appTheme.text} style={styles.usageTitle}>Credit Usage Analytics</Typography>
                  <Typography variant="caption" color={appTheme.muted}>Track consumption across LAD features</Typography>
                </View>
                <View style={[styles.rangeTabs, isNarrow && styles.rangeTabsFull]}>
                  {(['7d', '30d', '90d'] as const).map((range) => (
                    <TouchableOpacity
                      key={range}
                      onPress={() => handleRangeChange(range)}
                      style={[
                        styles.rangeTab,
                        isNarrow && styles.rangeTabFull,
                        { backgroundColor: selectedRange === range ? appTheme.primaryAccent : appTheme.softSurface },
                      ]}
                    >
                      <Typography variant="caption" color={selectedRange === range ? (appTheme.darkMode ? Theme.colors.primaryDark : Theme.colors.surface) : appTheme.muted} style={styles.rangeTabText}>{range}</Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.summaryGrid}>
                <View style={[styles.summaryTile, { width: summaryTileWidth, backgroundColor: appTheme.softSurface }]}>
                  <BarChart3 color={appTheme.primaryAccent} size={18} />
                  <View>
                    <Typography variant="caption" color={appTheme.muted}>Used</Typography>
                    <Typography variant="h3" color={appTheme.text}>{formatCredits(usage.totalCreditsUsed)}</Typography>
                  </View>
                </View>
                <View style={[styles.summaryTile, { width: summaryTileWidth, backgroundColor: appTheme.softSurface }]}>
                  <TrendingUp color={Theme.colors.success} size={18} />
                  <View>
                    <Typography variant="caption" color={appTheme.muted}>Trend</Typography>
                    <Typography variant="h3" color={appTheme.text}>{usage.monthlyTrend.percentageChange > 0 ? '+' : ''}{Math.round(usage.monthlyTrend.percentageChange * 10) / 10}%</Typography>
                  </View>
                </View>
                <View style={[styles.summaryTile, { width: summaryTileWidth, backgroundColor: appTheme.softSurface }]}>
                  <Zap color={Theme.colors.warning} size={18} />
                  <View>
                    <Typography variant="caption" color={appTheme.muted}>Top Feature</Typography>
                    <Typography variant="bodySmall" color={appTheme.text} style={styles.topFeatureText} numberOfLines={1}>{topFeature?.featureName || 'N/A'}</Typography>
                  </View>
                </View>
              </View>

              {usage.topFeatures.length ? (
                <View style={styles.usageFeatureList}>
                  {usage.topFeatures.map(renderUsageFeature)}
                </View>
              ) : (
                <View style={[styles.emptyUsage, { backgroundColor: appTheme.softSurface }]}>
                  <Typography variant="bodySmall" color={appTheme.muted}>No feature usage returned yet.</Typography>
                </View>
              )}
            </GlassCard>

            {usage.dailyUsage.length ? (
              <>
                <Typography variant="h4" color={appTheme.text} style={styles.sectionTitle}>Daily Usage</Typography>
                <GlassCard style={[styles.dailyCard, isCompact && styles.cardCompact]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.dailyBars}>
                      {usage.dailyUsage.slice(-10).map((day, index) => {
                        const height = Math.max(6, (day.credits / maxDailyCredits) * 100);
                        return (
                          <View key={`${day.date}-${index}`} style={styles.dailyBarColumn}>
                            <View style={[styles.dailyBarTrack, { backgroundColor: appTheme.borderSoft }]}>
                              <View style={[styles.dailyBarFill, { height: `${height}%`, backgroundColor: appTheme.primaryAccent }]} />
                            </View>
                            <Typography variant="overline" color={appTheme.muted}>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</Typography>
                            <Typography variant="overline" color={appTheme.text}>{formatCredits(day.credits, 1)}</Typography>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </GlassCard>
              </>
            ) : null}

            <Typography variant="h4" color={appTheme.text} style={styles.sectionTitle}>Credit Packages</Typography>
            {billing?.packages.length ? billing.packages.map((pack) => (
              <GlassCard key={pack.id} style={[styles.packageCard, isCompact && styles.cardCompact]}>
                <View style={[styles.packageHeader, isNarrow && styles.packageHeaderStack]}>
                  <View style={styles.packageText}>
                    <View style={styles.packageNameRow}>
                      <Typography variant="h4" color={appTheme.text}>{pack.name}</Typography>
                      {pack.popular ? <Badge label="Popular" variant="success" /> : null}
                    </View>
                    <Typography variant="bodySmall" color={appTheme.muted}>{pack.description || `${formatCredits(pack.credits)} credits`}</Typography>
                  </View>
                  <View style={[styles.packageAction, isNarrow && styles.packageActionStack]}>
                    <Typography variant="h3" color={appTheme.text}>{formatMoney(pack.price)}</Typography>
                    <Button label="Buy" size="sm" loading={checkoutId === pack.id} onPress={() => handleRecharge(pack)} style={[styles.buyButton, isNarrow && styles.buyButtonFull]} />
                  </View>
                </View>
              </GlassCard>
            )) : (
              <GlassCard style={styles.messageCard}>
                <Typography variant="bodySmall" color={appTheme.muted}>Backend did not return package rows. Use Add Credits to open Stripe checkout.</Typography>
              </GlassCard>
            )}

            <Typography variant="h4" color={appTheme.text} style={styles.sectionTitle}>Recent Transactions</Typography>
            <GlassCard style={[styles.paymentCard, isCompact && styles.cardCompact]}>
              {billing?.transactions.length ? billing.transactions.map((tx) => (
                <View key={tx.id} style={[styles.transactionRow, isCompact && styles.transactionRowCompact, { borderBottomColor: appTheme.borderSoft }]}>
                  <View style={styles.cardInfo}>
                    <View style={[styles.cardIconPlaceholder, { backgroundColor: appTheme.primaryAccent }]}>
                      <CreditCard color={appTheme.darkMode ? Theme.colors.primaryDark : Theme.colors.surface} size={18} />
                    </View>
                    <View style={styles.transactionText}>
                      <Typography variant="bodyLarge" color={appTheme.text} style={styles.transactionTitle} numberOfLines={1}>{tx.description}</Typography>
                      <Typography variant="caption" color={appTheme.muted}>{tx.type}</Typography>
                    </View>
                  </View>
                  <Typography variant="bodySmall" color={tx.amount < 0 ? Theme.colors.error : Theme.colors.success} style={styles.transactionAmount}>
                    {tx.amount < 0 ? '-' : '+'}{formatCredits(Math.abs(tx.amount))} credits
                  </Typography>
                </View>
              )) : (
                <Typography variant="bodySmall" color={appTheme.muted}>No wallet transactions returned yet.</Typography>
              )}
            </GlassCard>

            <Typography variant="h4" color={appTheme.text} style={styles.sectionTitle}>Credit Pricing</Typography>
            <View style={styles.pricingGrid}>
              {CREDIT_PRICING.map((item) => {
                const iconName = getFeatureIconName(item.icon, item.title);
                return (
                  <GlassCard key={item.title} style={[styles.pricingCard, { width: pricingCardWidth }]}>
                    <View style={[styles.featureIconWrap, { backgroundColor: appTheme.successSoft }]}>
                      <FeatureIcon icon={iconName} color={appTheme.primaryAccent} />
                    </View>
                    <View style={styles.pricingText}>
                      <Typography variant="bodySmall" color={appTheme.text} style={styles.pricingTitle}>{item.title}</Typography>
                      <Typography variant="caption" color={appTheme.muted}>{item.detail}</Typography>
                    </View>
                    <Typography variant="bodySmall" color={appTheme.primaryAccent} style={styles.pricingCost}>{item.cost}</Typography>
                  </GlassCard>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showAddCreditsModal} transparent animationType="fade" onRequestClose={() => setShowAddCreditsModal(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.addCreditsModal, { backgroundColor: appTheme.surface, maxWidth: isWide ? 560 : 440 }]}>
              <View style={[styles.modalHeader, isCompact && styles.modalHeaderCompact]}>
                <View style={styles.modalTitleText}>
                  <Typography variant="h3" color={appTheme.text}>Add Credits</Typography>
                  <Typography variant="caption" color={appTheme.muted}>Credits never expire and work across services</Typography>
                </View>
                <TouchableOpacity style={[styles.closeModalButton, { backgroundColor: appTheme.softSurface }]} onPress={() => setShowAddCreditsModal(false)}>
                  <X color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>

              <View style={styles.presetGrid}>
                {PRESET_AMOUNTS.map((preset) => {
                  const selected = selectedAmount === preset.value && !customAmount.trim();
                  return (
                    <TouchableOpacity
                      key={preset.value}
                      style={[
                        styles.presetCard,
                        {
                          width: presetCardWidth,
                          backgroundColor: selected ? appTheme.successSoft : appTheme.softSurface,
                          borderColor: selected ? appTheme.primaryAccent : appTheme.border,
                        },
                      ]}
                      onPress={() => handleSelectAmount(preset.value)}
                      activeOpacity={0.8}
                    >
                      <Typography variant="h3" color={appTheme.primaryAccent}>{formatCredits(preset.credits)}</Typography>
                      <Typography variant="caption" color={appTheme.muted}>credits</Typography>
                      <Typography variant="bodySmall" color={appTheme.text} style={styles.presetPrice}>${preset.value}</Typography>
                      <Typography variant="caption" color={appTheme.muted}>{preset.label}</Typography>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Typography variant="caption" color={appTheme.muted} style={styles.customAmountLabel}>Custom amount</Typography>
              <TextInput
                value={customAmount}
                onChangeText={(value) => {
                  setCustomAmount(value.replace(/[^\d.]/g, ''));
                  setSelectedAmount(null);
                }}
                placeholder="Enter amount in USD"
                placeholderTextColor={appTheme.disabled}
                keyboardType="decimal-pad"
                style={[styles.customAmountInput, WEB_INPUT_RESET, { backgroundColor: appTheme.input, borderColor: appTheme.border, color: appTheme.text }]}
              />

              {selectedCheckoutAmount ? (
                <View style={[styles.checkoutSummary, { backgroundColor: appTheme.successSoft }]}>
                  <Typography variant="caption" color={appTheme.text}>
                    You will receive about {formatCredits(estimatedCheckoutCredits)} credits for ${selectedCheckoutAmount}.
                  </Typography>
                </View>
              ) : null}

              <Button
                label="Proceed to Payment"
                loading={checkoutAmount !== null}
                disabled={!selectedCheckoutAmount || checkoutAmount !== null}
                onPress={handleProceedToPayment}
                style={styles.proceedButton}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    alignSelf: 'center',
    flexGrow: 1,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  headerRowCompact: {
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCard: {
    padding: Theme.spacing.xl,
    borderColor: Theme.colors.primary,
    borderWidth: 2,
  },
  walletCardCompact: {
    padding: Theme.spacing.md,
  },
  cardCompact: {
    padding: Theme.spacing.md,
  },
  walletHeroBand: {
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  walletHeaderStack: {
    flexDirection: 'column',
  },
  walletTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  walletTitleRowCompact: {
    alignItems: 'flex-start',
  },
  walletTitleText: {
    flex: 1,
    minWidth: 0,
  },
  walletIcon: {
    width: 48,
    height: 48,
    borderRadius: Theme.radius.full,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overline: {
    fontWeight: '700',
  },
  creditBalance: {
    marginTop: 3,
  },
  addCreditsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  addCreditsButtonFull: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 44,
  },
  addCreditsText: {
    color: Theme.colors.surface,
    fontWeight: '800',
  },
  minimumMeterTrack: {
    height: 10,
    borderRadius: Theme.radius.full,
    overflow: 'hidden',
    marginTop: Theme.spacing.lg,
  },
  minimumMeterFill: {
    height: '100%',
    borderRadius: Theme.radius.full,
  },
  minimumMeterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.borderLight,
    marginVertical: Theme.spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  metricTile: {
    minHeight: 82,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    justifyContent: 'space-between',
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  balanceTile: {
    flex: 1,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    },
  voiceMinimumBox: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  voiceMinimumTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: 5,
  },
  voiceMinimumTitle: {
    fontWeight: '800',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  featurePill: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 210,
    borderRadius: Theme.radius.full,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: Theme.spacing.sm,
    flexShrink: 1,
  },
  sectionTitle: {
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.xl,
  },
  usageCard: {
    padding: Theme.spacing.lg,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  usageHeaderStack: {
    flexDirection: 'column',
  },
  usageHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  usageTitle: {
    fontWeight: '800',
  },
  rangeTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  rangeTabsFull: {
    alignSelf: 'stretch',
  },
  rangeTab: {
    borderRadius: Theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rangeTabFull: {
    flex: 1,
    alignItems: 'center',
  },
  rangeTabText: {
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  summaryTile: {
    minHeight: 96,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.sm,
    justifyContent: 'space-between',
  },
  topFeatureText: {
    fontWeight: '800',
  },
  usageFeatureList: {
    gap: Theme.spacing.md,
  },
  usageFeatureItem: {
    gap: Theme.spacing.sm,
  },
  usageFeatureTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  usageFeatureLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageFeatureText: {
    flex: 1,
  },
  usageFeatureName: {
    fontWeight: '700',
  },
  usageFeatureValue: {
    alignItems: 'flex-end',
  },
  usageCredits: {
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyUsage: {
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.lg,
    alignItems: 'center',
  },
  dailyCard: {
    padding: Theme.spacing.lg,
  },
  dailyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
    minWidth: 560,
  },
  dailyBarColumn: {
    width: 48,
    alignItems: 'center',
    gap: 5,
  },
  dailyBarTrack: {
    width: 42,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  dailyBarFill: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  packageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  packageHeaderStack: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  packageText: {
    flex: 1,
  },
  packageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    flexWrap: 'wrap',
  },
  packageAction: {
    alignItems: 'flex-end',
    gap: Theme.spacing.sm,
  },
  packageActionStack: {
    alignItems: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buyButton: {
    minWidth: 72,
  },
  buyButtonFull: {
    minWidth: 96,
  },
  paymentCard: {
    padding: Theme.spacing.lg,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  transactionRowCompact: {
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
  },
  cardInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Theme.spacing.md,
  },
  cardIconPlaceholder: {
    width: 42,
    height: 32,
    backgroundColor: '#1A1F36',
    borderRadius: Theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionText: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  transactionTitle: {
    fontWeight: '500',
  },
  transactionAmount: {
    flexShrink: 0,
    textAlign: 'right',
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  pricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
  },
  pricingText: {
    flex: 1,
  },
  pricingTitle: {
    fontWeight: '800',
  },
  pricingCost: {
    fontWeight: '900',
  },
  messageCard: {
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  loader: {
    marginTop: Theme.spacing.xxl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'center',
    padding: Theme.spacing.xl,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  addCreditsModal: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 18,
    padding: Theme.spacing.xl,
    maxHeight: '88%',
    ...Theme.shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  modalHeaderCompact: {
    alignItems: 'flex-start',
  },
  modalTitleText: {
    flex: 1,
    minWidth: 0,
  },
  closeModalButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  presetCard: {
    borderRadius: Theme.radius.md,
    borderWidth: 2,
    padding: Theme.spacing.md,
    minHeight: 118,
    justifyContent: 'center',
  },
  presetPrice: {
    marginTop: 4,
    fontWeight: '800',
  },
  customAmountLabel: {
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xs,
    fontWeight: '800',
  },
  customAmountInput: {
    minHeight: 48,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: Theme.spacing.md,
    fontSize: 16,
  },
  checkoutSummary: {
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  proceedButton: {
    marginTop: Theme.spacing.lg,
  },
});
