import { Logo } from '@/components/ui/Logo';
import { Typography } from '@/components/ui/Typography';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const heroImage = require('../../assets/images/hero-ai-character.png');

const palette = {
  background: '#ffffff',
  surface: '#ffffff',
  primary: '#0f1743',
  text: '#111827',
  secondary: '#545f72',
  border: '#e2e8f0',
  footer: '#64748b',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const entrance = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const characterFloat = useRef(new Animated.Value(0)).current;
  const isPhone = width <= 430;
  const isDesktop = width >= 768;
  const isSmallPhone = width <= 390;
  const isShort = height < 780;
  const isTiny = isPhone && (width <= 360 || height < 700);
  const isMobileLayout = width < 560;
  const horizontalPadding = isTiny ? 18 : isPhone ? 24 : isDesktop ? 34 : 28;
  const contentWidth = Math.max(280, Math.min(width - horizontalPadding * 2, isDesktop ? 620 : isMobileLayout ? 382 : 430));
  const heroHeight = Math.min(
    contentWidth * (isDesktop ? 0.72 : isTiny ? 0.7 : 0.78),
    height * (isDesktop ? 0.4 : isTiny ? 0.3 : isShort ? 0.33 : 0.36),
    isDesktop ? 430 : isPhone ? 318 : 360,
  );
  const codeLogoSize = Math.min(isTiny ? 138 : isPhone ? 166 : isDesktop ? 278 : 220, contentWidth * 0.46);
  const heroTranslateX = isDesktop ? contentWidth * 0.18 : isPhone ? contentWidth * 0.1 : 70;
  const logoTranslateBase = codeLogoSize * -0.5;
  const titleFontSize = isDesktop ? 43 : isTiny ? 27 : isSmallPhone ? 30 : isPhone ? 33 : 38;
  const titleLineHeight = Math.round(titleFontSize * 1.18);
  const subtitleFontSize = isTiny ? 14 : isSmallPhone ? 15 : isPhone ? 16 : isDesktop ? 20 : 18;
  const subtitleLineHeight = Math.round(subtitleFontSize * 1.55);
  const buttonHeight = isTiny ? 52 : isPhone ? 56 : 62;
  const actionsWidth = Math.min(contentWidth, isTiny ? 304 : isMobileLayout ? 330 : 360);
  const copyGap = isDesktop ? 52 : isTiny ? 48 : isPhone ? 78 : 58;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entrance, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloat, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(logoFloat, {
            toValue: 0,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(characterFloat, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(characterFloat, {
            toValue: 0,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();
  }, [characterFloat, entrance, logoFloat]);

  const logoMotionStyle = {
    opacity: 1,
    transform: [
      {
        translateY: logoFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [logoTranslateBase - 6, logoTranslateBase + 7],
        }),
      },
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
      {
        rotate: logoFloat.interpolate({
          inputRange: [0, 1],
          outputRange: ['-1.2deg', '1.2deg'],
        }),
      },
    ],
  };

  const characterMotionStyle = {
    opacity: 1,
    transform: [
      {
        translateX: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [heroTranslateX + 18, heroTranslateX],
        }),
      },
      {
        translateY: characterFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [8, -8],
        }),
      },
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.container,
        isPhone && styles.containerPhone,
        isTiny && styles.containerTiny,
        {
          minHeight: height,
          paddingTop: Math.max(insets.top, isPhone ? 12 : 0),
          paddingHorizontal: horizontalPadding,
          paddingBottom: Math.max(insets.bottom + 12, isTiny ? 16 : 24),
        },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={[styles.main, isDesktop && styles.mainDesktop, isPhone && styles.mainPhone, isTiny && styles.mainTiny, { width: contentWidth }]}>
        <View style={[styles.heroFrame, isDesktop && styles.heroFrameDesktop, { width: contentWidth, height: heroHeight }]}>
          <Animated.View
            style={[
              styles.logo,
              isDesktop && styles.logoDesktop,
              isPhone && styles.logoPhone,
              isTiny && styles.logoTiny,
              logoMotionStyle,
            ]}
          >
            <Logo
              variant="code"
              width={codeLogoSize}
              height={codeLogoSize}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.heroImageWrap,
              isDesktop && styles.heroImageWrapDesktop,
              isPhone && styles.heroImageWrapPhone,
              characterMotionStyle,
            ]}
          >
            <Image source={heroImage} style={styles.heroImage} contentFit="contain" />
          </Animated.View>
        </View>

        <View
          style={[
              styles.copy,
              isDesktop && styles.copyDesktop,
              isShort && styles.copyShort,
              isTiny && styles.copyTiny,
              isPhone && styles.copyPhone,
              { marginTop: copyGap },
            ]}
        >
          <Typography
            variant="h1"
            align="center"
            style={[
              styles.title,
              {
                fontSize: titleFontSize,
                lineHeight: titleLineHeight,
              },
            ]}
          >
            Enterprise AI{'\n'}Lead Management
          </Typography>
          <Typography
            variant="bodyLarge"
            align="center"
            style={[
              styles.subtitle,
              {
                fontSize: subtitleFontSize,
                lineHeight: subtitleLineHeight,
              },
            ]}
          >
            Streamline your sales pipeline with intelligent tracking and automated follow-ups.
          </Typography>
        </View>

        <View
          style={[
            styles.actions,
            isDesktop && styles.actionsDesktop,
            isShort && styles.actionsShort,
            isTiny && styles.actionsTiny,
            { width: actionsWidth },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.84}
            style={[styles.primaryButton, isTiny && styles.buttonTiny, { minHeight: buttonHeight }]}
            onPress={() => router.push('/signup')}
            accessibilityRole="button"
          >
            <Typography
              variant="bodyLarge"
              style={[styles.primaryButtonText, isTiny && styles.buttonTextTiny, { fontSize: isTiny ? 16 : isPhone ? 17 : 19 }]}
            >
              Get Started
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.72}
            style={[styles.secondaryButton, isTiny && styles.buttonTiny, { minHeight: buttonHeight }]}
            onPress={() => router.push('/login')}
            accessibilityRole="button"
          >
            <Typography
              variant="bodyLarge"
              style={[styles.secondaryButtonText, isTiny && styles.buttonTextTiny, { fontSize: isTiny ? 16 : isPhone ? 17 : 19 }]}
            >
              Log In
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, isPhone && styles.footerPhone, isTiny && styles.footerTiny, { width: contentWidth }]}>
        <View style={styles.footerLinks}>
          <TouchableOpacity activeOpacity={0.7}>
            <Typography variant="body" style={[styles.footerLink, isTiny && styles.footerLinkTiny]}>
              Privacy Policy
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}>
            <Typography variant="body" style={[styles.footerLink, isTiny && styles.footerLinkTiny]}>
              Terms
            </Typography>
          </TouchableOpacity>
        </View>
        <Typography
          variant="bodySmall"
          align="center"
          style={[styles.copyright, isTiny && styles.copyrightTiny]}
        >
          {'\u00A9'} 2024 MrLAD. All rights reserved.
        </Typography>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.background,
  },
  containerPhone: {
    justifyContent: 'flex-start',
  },
  containerTiny: {
    justifyContent: 'flex-start',
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 12,
  },
  mainPhone: {
    paddingBottom: 10,
  },
  mainTiny: {
    paddingBottom: 8,
  },
  mainDesktop: {
    paddingBottom: 10,
  },
  heroFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  heroFrameDesktop: {
    marginTop: 4,
  },
  logo: {
    position: 'absolute',
    left: 12,
    top: '51%',
    zIndex: 2,
  },
  logoPhone: {
    left: 10,
    top: '50%',
  },
  logoTiny: {
    left: 8,
    top: '49%',
  },
  logoDesktop: {
    left: 44,
    top: '53%',
  },
  heroImageWrap: {
    width: '96%',
    height: '100%',
    alignSelf: 'flex-end',
  },
  heroImageWrapPhone: {
    width: '98%',
  },
  heroImageWrapDesktop: {
    width: '76%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  copy: {
    marginTop: 14,
    alignItems: 'center',
    width: '100%',
  },
  copyPhone: {
    marginTop: 62,
  },
  copyDesktop: {
    marginTop: 18,
  },
  copyShort: {
    marginTop: 44,
  },
  copyTiny: {
    marginTop: 42,
  },
  title: {
    color: palette.text,
    fontWeight: '800',
  },
  titleDesktop: {
    fontSize: 44,
    lineHeight: 52,
  },
  titleSmallPhone: {
    fontSize: 29,
    lineHeight: 36,
  },
  titleTiny: {
    fontSize: 25,
    lineHeight: 31,
  },
  subtitle: {
    marginTop: 12,
    color: palette.secondary,
    fontWeight: '400',
    maxWidth: 360,
  },
  subtitleDesktop: {
    fontSize: 22,
    lineHeight: 34,
  },
  subtitleSmallPhone: {
    fontSize: 16,
    lineHeight: 24,
  },
  subtitleTiny: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionsDesktop: {
    maxWidth: 526,
    marginTop: 34,
  },
  actionsShort: {
    marginTop: 18,
    gap: 10,
  },
  actionsTiny: {
    marginTop: 14,
    gap: 8,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 13,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 13,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTiny: {
    minHeight: 52,
    borderRadius: 11,
  },
  primaryButtonText: {
    color: palette.surface,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  buttonTextTiny: {
    fontSize: 17,
    lineHeight: 24,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
  },
  footerPhone: {
    marginTop: 8,
    paddingTop: 14,
    paddingBottom: 10,
  },
  footerTiny: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  footerLink: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  footerLinkTiny: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyright: {
    marginTop: 16,
    color: palette.footer,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  copyrightTiny: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
});
