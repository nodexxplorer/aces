import { View, StyleSheet } from 'react-native';
import Text from './Text';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../theme/typography';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

export default function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { theme } = useTheme();
  const tones: Record<Tone, { bg: string; fg: string }> = {
    primary: { bg: theme.primaryMuted, fg: theme.primary },
    success: { bg: theme.successMuted, fg: theme.success },
    warning: { bg: theme.warningMuted, fg: theme.warning },
    danger: { bg: theme.dangerMuted, fg: theme.danger },
    neutral: { bg: theme.divider, fg: theme.textMuted },
  };
  const c = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
});
