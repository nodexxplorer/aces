import { View, type ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/typography';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export default function Card({ style, padded = true, children, ...rest }: CardProps) {
  const { theme, isDark } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          shadowOpacity: isDark ? 0 : 0.06,
        },
        padded && styles.padded,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 1,
  },
  padded: {
    padding: spacing.lg,
  },
});
