import type { ReactNode } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../ui/Text';
import AdminPackMark from '../AdminPackMark';
import { useTheme } from '../../theme/ThemeProvider';
import { palette } from '../../theme/colors';
import { fontFamily, fontSize, radius, spacing } from '../../theme/typography';
import type { LoginTemplate } from '../../config/signInLook';

interface Props {
  departmentName: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The department's sign-in template. Classic when omitted. */
  template?: LoginTemplate;
  /** The picture to draw for split and centered. Without one they draw as classic. */
  imageUri?: string;
  /** How dark the picture is made, from 0 (none) to 1 (opaque). */
  dim?: number;
  /** The look picker, shown above the title. */
  picker?: ReactNode;
}

/**
 * The sign-in and sign-up screens' frame. Three templates, chosen on the screen
 * itself and kept on this phone:
 * - classic: the platform mark on a brand gradient, with the form on a sheet below;
 * - split: the chosen picture as a band across the top, with the form sheet below;
 * - centered: the chosen picture as the full-screen backdrop, with the form in a card.
 */
export default function ModoolsAuthLayout({
  departmentName,
  title,
  subtitle,
  children,
  template = 'classic',
  imageUri,
  dim = 0.55,
  picker,
}: Props) {
  const { theme, brand } = useTheme();
  const insets = useSafeAreaInsets();

  if (template === 'centered' && imageUri) {
    return (
      <ImageBackground source={{ uri: imageUri }} style={styles.flex} resizeMode="cover">
        <View style={[styles.photoScrim, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
        <ScrollView
          contentContainerStyle={[
            styles.centeredContent,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInUp.duration(500).springify()}
            style={[styles.centeredCard, { backgroundColor: theme.background }]}
          >
            {picker ? <View style={styles.picker}>{picker}</View> : null}
            <Text style={[styles.departmentLine, { color: theme.primary }]}>{departmentName}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
            <View style={styles.body}>{children}</View>
          </Animated.View>
        </ScrollView>
      </ImageBackground>
    );
  }

  const split = template === 'split' && Boolean(imageUri);
  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      {split && imageUri ? (
        <ImageBackground
          source={{ uri: imageUri }}
          style={[styles.hero, styles.photoHero, { paddingTop: insets.top + spacing.xl }]}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.photoCaption}>
            <Text style={styles.heroTitle}>{departmentName}</Text>
          </Animated.View>
        </ImageBackground>
      ) : (
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
      )}

      <Animated.View
        entering={FadeInDown.duration(500).delay(150).springify()}
        style={[styles.sheet, { backgroundColor: theme.background }]}
      >
        {/* The sheet scrolls: a department picker with eight departments is
            taller than the sheet, and the button below it must stay reachable. */}
        <ScrollView
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {picker ? <View style={styles.picker}>{picker}</View> : null}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
          <View style={styles.body}>{children}</View>
        </ScrollView>
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
  sheetContent: {
    flexGrow: 1,
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
  picker: {
    marginBottom: spacing.xl,
  },
  photoHero: {
    height: '42%',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  photoCaption: {
    gap: spacing.xs,
  },
  photoScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centeredCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: radius['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  departmentLine: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
