import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Theme from '@/constants/theme';
import { Typography } from '@/components/ui/Typography';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppTheme } from '@/src/theme/appTheme';
import {
  Briefcase,
  Calendar,
  ClipboardList,
  Clock,
  CreditCard,
  FileAudio,
  FileSignature,
  FileText,
  History,
  LifeBuoy,
  ListOrdered,
  LogIn,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Package,
  PhoneMissed,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Users2,
  type LucideIcon,
} from 'lucide-react-native';

const ICONS = {
  Briefcase,
  Calendar,
  ClipboardList,
  Clock,
  CreditCard,
  FileAudio,
  FileSignature,
  FileText,
  History,
  LifeBuoy,
  ListOrdered,
  LogIn,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  Package,
  PhoneMissed,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Users2,
} satisfies Record<string, LucideIcon>;

export type DashboardIconName = keyof typeof ICONS;

export interface DashboardCard {
  label: string;
  count?: number;
  icon: DashboardIconName;
}

export interface DashboardSectionVariant {
  key: string;
  label: string;
  cards: DashboardCard[];
}

export interface DashboardSectionProps {
  title: string;
  icon: DashboardIconName;
  channel?: 'linkedin' | 'whatsapp' | 'email' | 'voice' | 'instagram';
  accentColor?: string;
  cards: DashboardCard[];
  /** When present with >1 entry, a segmented switcher lets the user swap card sets (e.g. WhatsApp Personal vs Business API). */
  variants?: DashboardSectionVariant[];
  onCardPress?: (card: DashboardCard, index: number) => void;
}

function ChannelIcon({
  channel,
  icon,
  color,
}: {
  channel?: DashboardSectionProps['channel'];
  icon: keyof typeof ICONS;
  color: string;
}) {
  const IconComponent = ICONS[icon];

  if (channel === 'linkedin') {
    return (
      <View style={[styles.brandIconContainer, { backgroundColor: color }]}>
        <FontAwesome5 name="linkedin-in" color={Theme.colors.surface} size={18} />
      </View>
    );
  }

  if (channel === 'whatsapp') {
    return (
      <View style={[styles.brandIconContainer, { backgroundColor: color }]}>
        <FontAwesome5 name="whatsapp" color={Theme.colors.surface} size={20} />
      </View>
    );
  }

  if (channel === 'email') {
    return (
      <View style={[styles.brandIconContainer, { backgroundColor: color }]}>
        <FontAwesome5 name="envelope" color={Theme.colors.surface} size={18} />
      </View>
    );
  }

  if (channel === 'instagram') {
    return (
      <View style={[styles.brandIconContainer, { backgroundColor: color }]}>
        <FontAwesome5 name="instagram" color={Theme.colors.surface} size={20} />
      </View>
    );
  }

  return (
    <View style={[styles.iconContainer, { backgroundColor: `${color}18` }]}>
      <IconComponent color={color} size={20} />
    </View>
  );
}

export function DashboardSection({
  title,
  icon,
  channel,
  accentColor = Theme.colors.primary,
  cards,
  variants,
  onCardPress,
}: DashboardSectionProps) {
  const { width } = useWindowDimensions();
  const appTheme = useAppTheme();

  const hasVariants = Array.isArray(variants) && variants.length > 1;
  const [activeVariantKey, setActiveVariantKey] = useState(() => variants?.[0]?.key);
  const activeVariant = useMemo(
    () => (hasVariants ? variants!.find((v) => v.key === activeVariantKey) ?? variants![0] : undefined),
    [hasVariants, variants, activeVariantKey],
  );
  const visibleCards = activeVariant?.cards ?? cards;

  // Responsive grid logic
  const numColumns = width > 768 ? 3 : 2;
  const cardWidth = (width - Theme.spacing.xl * 2 - Theme.spacing.md * (numColumns - 1)) / numColumns;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ChannelIcon channel={channel} icon={icon} color={accentColor} />
        <View style={styles.headerText}>
          <Typography variant="h4" color={appTheme.text}>{title}</Typography>
          {channel && (
            <Typography variant="caption" color={appTheme.muted}>
              {channel === 'voice' ? 'AI voice' : channel} activity
            </Typography>
          )}
        </View>
      </View>

      {hasVariants && (
        <View style={[styles.switcher, { backgroundColor: appTheme.surface, borderColor: appTheme.borderSoft }]}>
          {variants!.map((variant) => {
            const isActive = variant.key === (activeVariant?.key ?? variants![0].key);
            return (
              <TouchableOpacity
                key={variant.key}
                activeOpacity={0.8}
                onPress={() => setActiveVariantKey(variant.key)}
                style={[
                  styles.switcherTab,
                  isActive && { backgroundColor: accentColor },
                ]}
              >
                <Typography
                  variant="caption"
                  color={isActive ? Theme.colors.surface : appTheme.muted}
                  style={styles.switcherLabel}
                >
                  {variant.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.grid}>
        {visibleCards.map((card, index) => {
          const CardIcon = ICONS[card.icon];
          return (
            <Animated.View 
              key={index} 
              entering={FadeInUp.delay(index * 100).duration(500)}
            >
              <TouchableOpacity activeOpacity={0.7} onPress={() => onCardPress?.(card, index)}>
                <GlassCard style={[styles.card, { width: cardWidth, borderColor: appTheme.borderSoft }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIconShell, { backgroundColor: `${accentColor}12` }]}>
                      <CardIcon color={accentColor} size={18} />
                    </View>
                    {card.count !== undefined && (
                      <Typography variant="h3" color={accentColor} style={styles.countText}>
                        {card.count}
                      </Typography>
                    )}
                  </View>
                  <Typography variant="bodySmall" color={appTheme.text} style={styles.cardLabel} numberOfLines={2}>
                    {card.label}
                  </Typography>
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  headerText: {
    flex: 1,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 10,
  },
  brandIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcher: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Theme.spacing.md,
    gap: 2,
  },
  switcherTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  switcherLabel: {
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  card: {
    padding: Theme.spacing.md,
    minHeight: 108,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardIconShell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  cardLabel: {
    fontWeight: '500',
    marginTop: Theme.spacing.sm,
    lineHeight: 18,
  },
});
