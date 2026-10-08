import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../theme/typography';
import type { Department } from '../api/tenants';

interface Props {
  label?: string;
  departments: Department[];
  value: string;
  onChange: (slug: string) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
  /** A validation message, shown under the list. */
  message?: string;
}

/** Lists the departments and marks the chosen one. Each row names the department and its institution. */
export default function DepartmentPicker({ label = 'Department', departments, value, onChange, loading, error, onRetry, message }: Props) {
  const { theme } = useTheme();

  let body;
  if (loading && departments.length === 0) {
    body = (
      <View style={styles.status}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  } else if (departments.length === 0) {
    body = (
      <Pressable onPress={onRetry} style={styles.status} accessibilityRole="button">
        <Text style={[styles.sub, { color: theme.textMuted }]}>{error || 'No departments are available.'} Tap to try again.</Text>
      </Pressable>
    );
  } else {
    body = departments.map((d) => {
      const selected = d.slug === value;
      const ink = selected ? theme.onPrimary : theme.text;
      const sub = selected ? theme.onPrimary : theme.textMuted;
      return (
        <Pressable
          key={d.slug}
          onPress={() => onChange(d.slug)}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          style={[styles.row, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.cardBorder }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: ink }]}>{d.name}</Text>
            {d.institution ? <Text style={[styles.sub, { color: sub }]}>{d.institution}</Text> : null}
          </View>
          {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.onPrimary} /> : null}
        </Pressable>
      );
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      {body}
      {message ? <Text style={[styles.sub, { color: theme.textMuted }]}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, marginBottom: spacing.xs },
  status: { paddingVertical: spacing.md, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1 },
  name: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm - 1, marginTop: 2 },
});
