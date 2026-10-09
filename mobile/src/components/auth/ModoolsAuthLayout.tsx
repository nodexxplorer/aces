import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../ui/Text';
import AdminPackMark from '../AdminPackMark';
import { useTheme } from '../../theme/ThemeProvider';
import { palette } from '../../theme/colors';
import { fontFamily, fontSize, radius, spacing } from '../../theme/typography';

interface Props {
  departmentName: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** The sign-in and sign-up screens' frame: the platform mark, the chosen department, and a sheet with the form. */
export default function ModoolsAuthLayout({ departmentName, title, subtitle, children }: Props) {
  const { theme, brand } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[brand[500], brand[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
      >
        <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.heroContent}>
          <AdminPackMark size={88} />
          <Text style={styles.heroTitle}>Admin Pack</Text>
          <Text style={styles.heroSubtitle}>{departmentName}</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.View
        entering={FadeInDown.duration(500).delay(150).springify()}
        style={[styles.sheet, { backgroundColor: theme.background }]}
      >
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    height: '38%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    color: palette.white,
  },
  heroSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  sheet: {
    flex: 1,
    marginTop: -radius['2xl'],
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  body: {
    marginTop: spacing['2xl'],
    gap: spacing.lg,
  },
});
