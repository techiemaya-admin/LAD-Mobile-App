import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';

export interface IOSSubscreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  showBack?: boolean;
}

export const IOSSubscreenHeader: React.FC<IOSSubscreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightElement,
  showBack = true,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as never);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16) + 6,
          backgroundColor: appTheme.background,
          borderBottomColor: appTheme.borderSoft,
        },
      ]}
    >
      <View style={styles.topRow}>
        {showBack ? (
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: appTheme.darkMode
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.04)',
                borderColor: appTheme.borderSoft,
              },
            ]}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft color={appTheme.text} size={22} strokeWidth={2.4} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}

        <View style={styles.rightActions}>{rightElement || null}</View>
      </View>

      <View style={styles.titleBlock}>
        <Typography variant="h1" color={appTheme.text} style={styles.title} numberOfLines={1}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="bodySmall" color={appTheme.muted} style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 36,
    height: 36,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleBlock: {
    marginTop: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
});

export { IOSCollapsibleScrollView, type IOSCollapsibleScrollViewProps } from './IOSCollapsibleScrollView';

