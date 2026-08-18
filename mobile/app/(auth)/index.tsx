import { StyleSheet, View } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Button from '../../src/components/ui/Button';
import { haptics } from '../../src/utils/haptics';


const introVideo = require('../../assets/videos/acesvideo.mp4');

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(introVideo, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const handleContinue = () => {
    haptics.tap();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.flex}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />

      <LinearGradient
        colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.textBlock}>
          <Text style={styles.title}>ACES Zone</Text>
          <Text style={styles.subtitle}>
            Association of Computer Engineering Students — Uniuyo Chapter, in your pocket.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(500).delay(500)} style={styles.buttonWrap}>
          <Button label="Continue" onPress={handleContinue} fullWidth size="lg" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    gap: spacing['2xl'],
  },
  textBlock: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    color: '#fff',
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
  buttonWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
