import { View, StyleSheet } from 'react-native';
import Text from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../../theme/typography';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Tints the icon/title for a "good news" empty state (e.g. "all caught
   * up") without giving up the shared folder icon everywhere else uses. */
  tone?: 'neutral' | 'success';
}

// The single empty-list visual used across the app — every screen with "no
// items yet" renders through this instead of picking its own one-off icon,
// so an empty Notifications tab, an empty Connect list, and an empty
// Payments history all read as the same kind of "nothing here" state.
export default function EmptyState({ title, description, tone = 'neutral' }: EmptyStateProps) {
  const { theme } = useTheme();
  const color = tone === 'success' ? theme.success : theme.textFaint;

  return (
    <View style={styles.wrap}>
      <Ionicons name="folder-open-outline" size={40} color={color} />
      <Text style={[styles.title, { color: tone === 'success' ? theme.text : theme.textMuted }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: theme.textFaint }]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
