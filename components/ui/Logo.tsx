import React from 'react';
import { Image, ImageProps } from 'expo-image';
import { ImageStyle, StyleProp } from 'react-native';

export type LogoVariant = 'main' | 'icon' | 'code';

interface LogoProps extends Omit<ImageProps, 'source'> {
  variant?: LogoVariant;
  size?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

const LOGOS = {
  main: require('../../app/MrLAD-logo.svg'),
  icon: require('../../app/logo.svg'),
  code: require('../../app/MrLad-code.svg'),
};

export function Logo({ variant = 'main', size, width, height, style, ...props }: LogoProps) {
  const source = LOGOS[variant];
  
  const imageStyle: StyleProp<ImageStyle> = [
    size ? { width: size, height: size } : { width: width || 120, height: height || 40 },
    style
  ];

  return (
    <Image
      source={source}
      style={imageStyle}
      contentFit="contain"
      {...props}
    />
  );
}
