import { ScrollView, View, StyleSheet, RefreshControl, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/typography';
import { TAB_BAR_FOOTPRINT } from '../FloatingTabBar';

interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

// Every tab screen renders through this so background color, safe padding,
// and pull-to-refresh behave identically everywhere instead of being
// re-implemented per screen. Screens with their own custom header (e.g. the
// Dashboard's gradient hero) apply insets.top themselves instead of using
// this component for their top section.
export default function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const topPadding = insets.top + spacing.xl;
  // FloatingTabBar overlays every screen nested under (tabs) — including
  // ones with no tab item of their own, like Profile — so the last bit of
  // scrollable content needs enough clearance to not end up hidden under it.
  // Screens outside (tabs) just get a bit of harmless extra bottom space.
  const bottomPadding = insets.bottom + TAB_BAR_FOOTPRINT + spacing.md;

  if (!scroll) {
    return (
      <View
        style={[
          styles.flex,
          { backgroundColor: theme.background, paddingTop: topPadding, paddingBottom: bottomPadding },
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        ) : undefined
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
});
