import { Logo } from '@/components/ui/Logo';
import { Typography } from '@/components/ui/Typography';
import { useAppTheme } from '@/src/theme/appTheme';
import { Audio, ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Volume2, VolumeX } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const heroVideoLight = require('../../assets/videos/hero-character.webm');
const heroVideoDark = require('../../assets/videos/hero-character-dark.mp4');
const heroImage = require('../../assets/images/hero-ai-character.png');

// Both greeting clips are 720x1280 (portrait 9:16). Locking the frame to this
// ratio guarantees the full character is visible with no cropping.
const HERO_VIDEO_ASPECT = 720 / 1280;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const appTheme = useAppTheme();
  const dark = appTheme.darkMode;
  const entrance = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<Video>(null);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const loopTimeoutRef = useRef<any>(null);

  useFocusEffect(
    useCallback(() => {
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.playAsync();
      }
      return () => {
        setIsPlaying(false);
        setMuted(true); // Force mute when leaving screen to prevent ghost audio
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          loopTimeoutRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.pauseAsync();
        }
      };
    }, [])
  );

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.didJustFinish) {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
      }
      loopTimeoutRef.current = setTimeout(() => {
        setIsPlaying((currentIsPlaying) => {
          if (currentIsPlaying && videoRef.current) {
            videoRef.current.setPositionAsync(0);
            videoRef.current.playAsync();
          }
          return currentIsPlaying;
        });
      }, 3000);
    }
  }, []);

  // The light clip is WebM (VP8), which iOS AVPlayer cannot decode - fall back to the
  // static hero image there. The dark clip is H.264 MP4 and plays everywhere.
  const heroVideoSupported = dark || Platform.OS !== 'ios';

  const colors = useMemo(() => ({
    background: dark ? '#0F172A' : '#ffffff',
    blob: dark ? '#1E293B' : '#E8EAF4',
    blobSoft: dark ? '#172033' : '#EDEFF7',
    heading: dark ? '#F8FAFC' : '#172560',
    subtitle: dark ? '#CBD5E1' : '#545f72',
    primaryButtonBg: dark ? '#F8FAFC' : '#0f1743',
    primaryButtonText: dark ? '#0f1743' : '#ffffff',
    secondaryButtonBg: dark ? '#111827' : '#ffffff',
    secondaryButtonBorder: dark ? '#334155' : '#e2e8f0',
    secondaryButtonText: dark ? '#F8FAFC' : '#1f2937',
    soundButtonBg: dark ? '#1E293B' : '#ffffff',
    soundButtonBorder: dark ? '#334155' : '#e2e8f0',
    soundIcon: dark ? '#F8FAFC' : '#172560',
    footerBorder: dark ? '#263244' : '#e6e9f2',
    footerLink: dark ? '#CBD5E1' : '#475569',
    copyright: dark ? '#8fa0b8' : '#64748b',
  }), [dark]);

  const isPhone = width <= 430;
  const isDesktop = width >= 768;
  const isShort = height < 780;
  const isTiny = isPhone && (width <= 360 || height < 700);
  const horizontalPadding = isTiny ? 20 : isPhone ? 24 : isDesktop ? 40 : 30;
  const contentWidth = Math.max(280, Math.min(width - horizontalPadding * 2, isDesktop ? 560 : 430));
  
  // Make sizes slightly smaller to ensure no scrolling
  const titleFontSize = isDesktop ? 38 : isTiny ? 24 : isPhone ? 28 : 32;
  const titleLineHeight = Math.round(titleFontSize * 1.2);
  const subtitleFontSize = isTiny ? 13 : isPhone ? 14 : isDesktop ? 17 : 15;
  const subtitleLineHeight = Math.round(subtitleFontSize * 1.5);
  const buttonHeight = isTiny ? 46 : isPhone ? 50 : 54;
  const logoHeight = isTiny ? 45 : 55;
  const logoWidth = logoHeight * 3.1;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const toggleMuted = useCallback(async () => {
    const next = !muted;
    if (!next) {
      // Make sure the greeting is audible even when the iOS silent switch is on.
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      // Restart so the "Hi!" plays from the top when sound comes on.
      await videoRef.current?.setPositionAsync(0).catch(() => {});
    }
    setMuted(next);
  }, [muted]);

  const entranceStyle = {
    opacity: entrance,
    transform: [
      {
        translateY: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  const heroEntranceStyle = {
    opacity: entrance,
    flex: 1,
    minHeight: 150,
    aspectRatio: HERO_VIDEO_ASPECT,
    alignSelf: 'center' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transform: [
      {
        scale: entrance.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
    ],
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { 
        flex: 1,
        paddingTop: Math.max(insets.top, 10),
        paddingHorizontal: horizontalPadding,
        paddingBottom: Math.max(insets.bottom, 10),
      }]}>
        <View pointerEvents="none" style={styles.blobLayer}>
          <View style={[styles.blob, styles.blobTopRight, { left: width * 0.74, backgroundColor: colors.blobSoft }]} />
          <View style={[styles.blob, styles.blobBottomLeft, { top: height * 0.78, left: -width * 0.2, backgroundColor: colors.blob }]} />
        </View>

        <View style={[styles.main, { width: contentWidth, flex: 1 }]}>
          <Animated.View style={[styles.header, entranceStyle]}>
            <Logo variant={dark ? 'mainWhite' : 'main'} width={logoWidth} height={logoHeight} />
          </Animated.View>

          <Animated.View style={[styles.copy, entranceStyle]}>
            <Typography
              variant="h1"
              style={[styles.title, { color: colors.heading, fontSize: titleFontSize, lineHeight: titleLineHeight }]}
            >
              Enterprise AI{'\n'}Lead Management
            </Typography>
            <Typography
              variant="bodyLarge"
              style={[styles.subtitle, { color: colors.subtitle, fontSize: subtitleFontSize, lineHeight: subtitleLineHeight }]}
            >
              Streamline your sales pipeline with intelligent tracking and automated follow-ups.
            </Typography>
          </Animated.View>

          <Animated.View
            style={[
              heroEntranceStyle,
              dark && styles.heroFrameDark,
            ]}
          >
            {heroVideoSupported ? (
              <Video
                key={dark ? 'hero-dark' : 'hero-light'}
                ref={videoRef}
                source={dark ? heroVideoDark : heroVideoLight}
                style={styles.heroVideo}
                videoStyle={styles.heroVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isPlaying}
                isLooping={false}
                isMuted={muted || !isPlaying}
                useNativeControls={false}
                usePoster={true}
                posterSource={heroImage}
                posterStyle={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              />
            ) : (
              <Image source={heroImage} style={styles.heroVideo} contentFit="contain" />
            )}
          </Animated.View>

          <Animated.View style={[styles.actions, entranceStyle, { width: contentWidth }]}>
            <TouchableOpacity
              activeOpacity={0.84}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primaryButtonBg, minHeight: buttonHeight, borderRadius: buttonHeight / 2 },
              ]}
              onPress={() => router.push('/login')}
              accessibilityRole="button"
            >
              <Typography
                variant="bodyLarge"
                style={[styles.primaryButtonText, { color: colors.primaryButtonText, fontSize: isTiny ? 16 : 17 }]}
              >
                Get Started
              </Typography>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.72}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.secondaryButtonBg,
                  borderColor: colors.secondaryButtonBorder,
                  minHeight: buttonHeight,
                  borderRadius: buttonHeight / 2,
                },
              ]}
              onPress={() => router.push('/login')}
              accessibilityRole="button"
            >
              <Typography
                variant="bodyLarge"
                style={[styles.secondaryButtonText, { color: colors.secondaryButtonText, fontSize: isTiny ? 16 : 17 }]}
              >
                Log In
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={[styles.footer, { width: contentWidth, borderTopColor: colors.footerBorder }]}>
          <View style={styles.footerLinks}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(auth)/privacy-policy')}>
              <Typography variant="body" style={[styles.footerLink, { color: colors.footerLink }]}>Privacy Policy</Typography>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(auth)/terms-of-service')}>
              <Typography variant="body" style={[styles.footerLink, { color: colors.footerLink }]}>Terms</Typography>
            </TouchableOpacity>
          </View>
          <Typography variant="bodySmall" align="center" style={[styles.copyright, { color: colors.copyright }]}>
            {'©'} 2024 MrLAD. All rights reserved.
          </Typography>
        </View>
      </View>

      {heroVideoSupported ? (
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => void toggleMuted()}
          style={[
            styles.soundButton,
            {
              top: Math.max(insets.top + 10, 18),
              right: 16,
              backgroundColor: colors.soundButtonBg,
              borderColor: colors.soundButtonBorder,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute greeting' : 'Mute greeting'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {muted
            ? <VolumeX color={colors.soundIcon} size={18} />
            : <Volume2 color={colors.soundIcon} size={18} />}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blobLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTopRight: {
    top: 84,
    width: 150,
    height: 150,
  },
  blobBottomLeft: {
    width: 260,
    height: 260,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingBottom: 12,
  },
  header: {
    width: '100%',
    alignItems: 'flex-start',
  },
  copy: {
    marginTop: 26,
    width: '100%',
    alignItems: 'flex-start',
  },
  title: {
    fontWeight: '800',
    textAlign: 'left',
  },
  subtitle: {
    marginTop: 12,
    fontWeight: '400',
    textAlign: 'left',
    maxWidth: 360,
  },
  heroFrame: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Rounded corners hide any slight shade difference between the dark clip's
  // background and the page background.
  heroFrameDark: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroVideo: {
    width: '100%',
    height: '100%',
  },
  soundButton: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f1743',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 10,
  },
  actions: {
    marginTop: 18,
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f1743',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  secondaryButton: {
    width: '100%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    lineHeight: 26,
    fontWeight: '800',
  },
  secondaryButtonText: {
    lineHeight: 26,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 14,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34,
  },
  footerLink: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  copyright: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
