import { Pressable, Text, ActivityIndicator, StyleSheet, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../theme/typography';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.primary, fg: theme.onPrimary },
    secondary: { bg: theme.primaryMuted, fg: theme.primary },
    outline: { bg: 'transparent', fg: theme.text, border: theme.cardBorder },
    ghost: { bg: 'transparent', fg: theme.primary },
    danger: { bg: theme.danger, fg: theme.onPrimary },
  };
  const sizing: Record<Size, { paddingV: number; paddingH: number; fontSize: number }> = {
    sm: { paddingV: spacing.sm, paddingH: spacing.md, fontSize: fontSize.sm },
    md: { paddingV: spacing.md, paddingH: spacing.lg, fontSize: fontSize.base },
    lg: { paddingV: spacing.lg, paddingH: spacing.xl, fontSize: fontSize.md },
  };
  const colors = palette[variant];
  const dims = sizing[size];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={(e) => {
        scale.value = withTiming(0.97, { duration: 100 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 150 });
        onPressOut?.(e);
      }}
      style={[
        animatedStyle,
        styles.base,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: colors.border ? StyleSheet.hairlineWidth : 0,
          paddingVertical: dims.paddingV,
          paddingHorizontal: dims.paddingH,
          opacity: isDisabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.fg} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: colors.fg, fontSize: dims.fontSize }]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  label: {
    fontFamily: fontFamily.semibold,
  },
});
