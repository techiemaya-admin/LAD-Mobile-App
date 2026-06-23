import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from './Typography';

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  style?: ViewStyle;
  authToken?: string | null;
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = 'md', style, authToken }) => {
  const [imageFailed, setImageFailed] = useState(false);

  const getSize = (): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm': return 32;
      case 'md': return 48;
      case 'lg': return 56;
      case 'xl': return 80;
      default: return 48;
    }
  };

  const dim = getSize();
  const showImage = Boolean(src && !imageFailed);
  // Show up to 2 characters of initials
  const initials = fallback.substring(0, 2).toUpperCase();
  const textVariant = dim <= 28 ? 'caption' : dim <= 36 ? 'caption' : 'h4';
  const fallbackFontSize = Math.max(dim * 0.34, 10);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <View style={[{ width: dim, height: dim, borderRadius: dim / 2, overflow: 'hidden' }, style]}>
      {showImage ? (
        <Image
          source={{
            uri: src,
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          }}
          style={{ width: dim, height: dim }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.fallbackContainer, { width: dim, height: dim }]}>
          <Typography
            variant={textVariant}
            color={Theme.colors.primary}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontWeight: '700',
              fontSize: fallbackFontSize,
              lineHeight: Math.ceil(fallbackFontSize * 1.12),
              textAlign: 'center',
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
  fallbackContainer: {
    backgroundColor: Theme.colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
