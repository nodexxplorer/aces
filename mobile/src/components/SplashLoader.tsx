import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Text from './ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { palette } from '../theme/colors';
import { fontFamily, fontSize, spacing } from '../theme/typography';

// The first thing anyone sees, every cold start — worth the extra
// choreography: a glow that breathes behind the mark, the mark itself
// overshooting into place, then the wordmark and tagline catching up.
export default function SplashLoader() {
  const glowScale = useSharedValue(0.85);
  const glowOpacity = useSharedValue(0.35);
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-12);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(14);
  const dotProgress = useSharedValue(0);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.25, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );

    logoOpacity.value = withTiming(1, { duration: 500 });
    logoScale.value = withSpring(1, { damping: 7, stiffness: 90 });
    logoRotate.value = withSpring(0, { damping: 8, stiffness: 90 });

    textOpacity.value = withDelay(350, withTiming(1, { duration: 450 }));
    textTranslateY.value = withDelay(350, withSpring(0, { damping: 12, stiffness: 120 }));

    dotProgress.value = withDelay(700, withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1));
  }, [dotProgress, glowOpacity, glowScale, logoOpacity, logoRotate, logoScale, textOpacity, textTranslateY]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }, { rotate: `${logoRotate.value}deg` }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <LinearGradient
      colors={[palette.primary[700], palette.primary[500], palette.primary[400]]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.container}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image source={require('../../assets/aces-logo.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={textStyle}>
          <Text style={styles.title}>ACES Zone</Text>
          <Text style={styles.subtitle}>Association of Computer Engineering Students</Text>
        </Animated.View>

        <View style={styles.dotsRow}>
          <Dot progress={dotProgress} offset={0} />
          <Dot progress={dotProgress} offset={0.15} />
          <Dot progress={dotProgress} offset={0.3} />
        </View>
      </View>
    </LinearGradient>
  );
}

function Dot({ progress, offset }: { progress: SharedValue<number>; offset: number }) {
  const style = useAnimatedStyle(() => {
    const t = (progress.value + offset) % 1;
    const bump = t < 0.5 ? t * 2 : (1 - t) * 2; // 0 -> 1 -> 0 triangle wave
    return {
      opacity: 0.35 + bump * 0.65,
      transform: [{ scale: 0.7 + bump * 0.5 }],
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  logoWrap: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: palette.white,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing['3xl'],
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing['3xl'],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.white,
  },
});
