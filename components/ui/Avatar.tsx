import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from './Typography';

// Global cache of failed/expired URLs to prevent infinite network retry storms
const failedImageUrls = new Set<string>();

interface AvatarProps {
  src?: string | null;
  fallback: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  style?: ViewStyle;
  authToken?: string | null;
}

const PASTEL_PALETTES = [
  { bg: '#EFF6FF', text: '#2563EB', border: 'rgba(37, 99, 235, 0.18)' }, // Blue
  { bg: '#F5F3FF', text: '#7C3AED', border: 'rgba(124, 58, 237, 0.18)' }, // Purple
  { bg: '#ECFDF5', text: '#059669', border: 'rgba(5, 150, 105, 0.18)' }, // Emerald
  { bg: '#FFF7ED', text: '#EA580C', border: 'rgba(234, 88, 12, 0.18)' }, // Orange
  { bg: '#FDF2F8', text: '#DB2777', border: 'rgba(219, 39, 119, 0.18)' }, // Pink
  { bg: '#F0FDFA', text: '#0D9488', border: 'rgba(13, 148, 136, 0.18)' }, // Teal
  { bg: '#FEF2F2', text: '#DC2626', border: 'rgba(220, 38, 38, 0.18)' }, // Red
  { bg: '#F8FAFC', text: '#475569', border: 'rgba(71, 85, 105, 0.18)' }, // Slate
];

const getPaletteForString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return PASTEL_PALETTES[hash % PASTEL_PALETTES.length];
};

const isValidUrl = (url?: string | null): url is string => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length < 8) return false;
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:');
};

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = 'md', style, authToken }) => {
  const normalizedSrc = useMemo(() => {
    if (!isValidUrl(src)) return null;
    if (failedImageUrls.has(src)) return null;
    return src;
  }, [src]);

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const getSize = (): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm': return 32;
      case 'md': return 46;
      case 'lg': return 56;
      case 'xl': return 80;
      default: return 46;
    }
  };

  const dim = getSize();
  const showImage = Boolean(normalizedSrc && !hasError);
  const initials = (fallback || '?').substring(0, 2).toUpperCase();
  const palette = useMemo(() => getPaletteForString(fallback || 'User'), [fallback]);
  const fallbackFontSize = Math.max(Math.round(dim * 0.36), 11);

  const handleError = () => {
    if (src) {
      failedImageUrls.add(src);
    }
    setHasError(true);
  };

  return (
    <View
      style={[
        styles.avatarContainer,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{
            uri: normalizedSrc!,
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          onError={handleError}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.fallbackContainer,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              backgroundColor: palette.bg,
              borderColor: palette.border,
              borderWidth: 1,
            },
          ]}
        >
          <Typography
            variant="caption"
            color={palette.text}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontWeight: '700',
              fontSize: fallbackFontSize,
              lineHeight: Math.ceil(fallbackFontSize * 1.2),
              textAlign: 'center',
              letterSpacing: -0.2,
            }}
          >
            {initials}
          </Typography>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
