import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import Theme from '@/constants/theme';
import { Typography } from './Typography';

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = 'md', style }) => {
  const [imageFailed, setImageFailed] = useState(false);

  const getSize = () => {
    switch (size) {
      case 'sm': return 32;
      case 'md': return 48;
      case 'lg': return 56;
      case 'xl': return 80;
    }
  };

  const dim = getSize();
  const showImage = Boolean(src && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <View style={[{ width: dim, height: dim, borderRadius: dim / 2, overflow: 'hidden' }, style]}>
      {showImage ? (
        <Image source={{ uri: src }} style={{ width: dim, height: dim }} onError={() => setImageFailed(true)} />
      ) : (
        <View style={[styles.fallbackContainer, { width: dim, height: dim }]}>
          <Typography 
            variant={size === 'sm' ? 'caption' : 'h4'} 
            color={Theme.colors.primary}
            style={{ fontWeight: '700' }}
          >
            {fallback.substring(0, 1).toUpperCase()}
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
