import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// Drop-in replacement for RN's <Text> that respects the user's Font Size
// preference (Settings > Text Size) without every screen needing to touch
// its own StyleSheet: it reads whatever static `fontSize` the screen already
// set, multiplies it by the current scale, and layers that on top as the
// last style entry (which wins) — so screens keep authoring plain
// `fontSize: fontSize.sm` in StyleSheet.create() like normal, and just
// import Text from here instead of 'react-native'.
export default function Text({ style, ...rest }: TextProps) {
  const { fontScale } = useTheme();
  if (fontScale === 1) return <RNText style={style} {...rest} />;

  const flat = StyleSheet.flatten(style);
  const baseSize = typeof flat?.fontSize === 'number' ? flat.fontSize : undefined;
  if (baseSize === undefined) return <RNText style={style} {...rest} />;

  return <RNText style={[style, { fontSize: baseSize * fontScale }]} {...rest} />;
}
