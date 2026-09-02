import { useEffect } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Text from './ui/Text';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, fontSize, spacing } from '../theme/typography';
import { haptics } from '../utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;
type Route = { key: string; name: string };

// Maps each bottom-tab route to its icon — kept here instead of per-screen
// tabBarIcon options since this bar renders icons itself.
const ICONS: Record<string, IconName> = {
  index: 'home',
  courses: 'book',
  attendance: 'checkmark-circle',
  connect: 'chatbubbles',
  payments: 'cash',
};

// Fixed left/right split around the floating center button — explicit
// rather than derived from registration order, so the visual layout doesn't
// silently shift if screens are reordered in app/(tabs)/_layout.tsx. Profile
// isn't a bottom tab — it's reachable from the Home header avatar instead.
const LEFT_ROUTE_NAMES = ['courses', 'payments'];
const RIGHT_ROUTE_NAMES = ['attendance', 'connect'];
const CENTER_ROUTE_NAME = 'index';

const BAR_HEIGHT = 64;
const CENTER_SIZE = 56;
const CENTER_RISE = 26; // how far the center button pokes above the bar's top edge
const NOTCH_RADIUS = 34;
const FLOAT_MARGIN = spacing.lg;

// The bar's total floating footprint above the screen's raw bottom edge,
// excluding the safe-area inset — any other absolutely-positioned element
// (a FAB, a chat input) needs at least this much clearance, plus
// insets.bottom, to avoid being covered by the bar or its raised center
// button.
export const TAB_BAR_FOOTPRINT = FLOAT_MARGIN + BAR_HEIGHT + CENTER_RISE;

// expo-router's `href: null` shortcut hides a tab by setting this style on
// its descriptor options rather than removing it from state.routes — since
// this bar fully replaces the default renderer, that filtering has to be
// done by hand.
function isHiddenRoute(options: { tabBarItemStyle?: StyleProp<ViewStyle> }) {
  return StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none';
}

// A rounded pill whose top edge scoops inward at the center — two mirrored
// cubic beziers forming a shallow "U" — so the floating center button looks
// like it's nested into the bar instead of just overlapping it.
function buildBarPath(width: number, height: number) {
  const cornerRadius = height / 2;
  const centerX = width / 2;
  const half = NOTCH_RADIUS * 1.3;
  const notchDepth = NOTCH_RADIUS * 0.9;

  return `
    M0,${cornerRadius}
    Q0,0 ${cornerRadius},0
    L${centerX - half},0
    C${centerX - half / 2},0 ${centerX - half / 2},${notchDepth} ${centerX},${notchDepth}
    C${centerX + half / 2},${notchDepth} ${centerX + half / 2},0 ${centerX + half},0
    L${width - cornerRadius},0
    Q${width},0 ${width},${cornerRadius}
    L${width},${height - cornerRadius}
    Q${width},${height} ${width - cornerRadius},${height}
    L${cornerRadius},${height}
    Q0,${height} 0,${height - cornerRadius}
    Z
  `;
}

function TabItem({
  route,
  isFocused,
  title,
  badge,
  onPress,
}: {
  route: Route;
  isFocused: boolean;
  title: string;
  badge?: number | string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, { damping: 15, stiffness: 180 });
  }, [isFocused, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.15 }, { translateY: progress.value * -2 }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  const iconName = ICONS[route.name] ?? 'ellipse';
  const color = isFocused ? theme.primary : theme.textFaint;

  return (
    <Pressable onPress={onPress} style={styles.tabItem} hitSlop={8} accessibilityRole="tab" accessibilityState={{ selected: isFocused }}>
      <Animated.View style={iconStyle}>
        <View style={styles.iconWrap}>
          <Ionicons name={isFocused ? iconName : (`${iconName}-outline` as IconName)} size={22} color={color} />
          {badge != null && badge !== 0 && badge !== '0' && (
            <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.card }]}>
              <Text style={styles.badgeText}>{typeof badge === 'number' && badge > 9 ? '9+' : String(badge)}</Text>
            </View>
          )}
        </View>
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color, fontFamily: isFocused ? fontFamily.semibold : fontFamily.medium },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Animated.View style={[styles.activeDot, { backgroundColor: theme.primary }, dotStyle]} />
    </Pressable>
  );
}

export default function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const barWidth = windowWidth - FLOAT_MARGIN * 2;
  const centerScale = useSharedValue(1);

  // A screen nested inside a tab's own stack (e.g. an open chat) calls
  // navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } })
  // to hide the bar entirely while it's focused — that option lands on the
  // focused tab's own descriptor, but nothing previously read it back out,
  // so the bar stayed floating on top of the chat composer regardless.
  // Computed here (not an early return) since every hook below must still
  // run on every render regardless — bailing out before them would break
  // the Rules of Hooks the moment two renders disagree on this value.
  const focusedOptions = descriptors[state.routes[state.index].key].options as { tabBarStyle?: StyleProp<ViewStyle> };
  const hidden = StyleSheet.flatten(focusedOptions.tabBarStyle)?.display === 'none';

  const visible = state.routes.filter((r) => !isHiddenRoute(descriptors[r.key].options));
  const byName = (name: string) => visible.find((r) => r.name === name);
  const leftRoutes = LEFT_ROUTE_NAMES.map(byName).filter((r): r is Route => !!r);
  const rightRoutes = RIGHT_ROUTE_NAMES.map(byName).filter((r): r is Route => !!r);
  const centerRoute = byName(CENTER_ROUTE_NAME);
  const activeKey = state.routes[state.index].key;
  const centerFocused = centerRoute ? activeKey === centerRoute.key : false;

  const goTo = (route: Route) => {
    const isFocused = activeKey === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      haptics.select();
      navigation.navigate(route.name);
    }
  };

  const centerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerScale.value }],
  }));

  const renderItem = (route: Route) => (
    <TabItem
      key={route.key}
      route={route}
      title={String(descriptors[route.key].options.title ?? route.name)}
      badge={descriptors[route.key].options.tabBarBadge}
      isFocused={activeKey === route.key}
      onPress={() => goTo(route)}
    />
  );

  if (hidden) {
    return null;
  }

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + FLOAT_MARGIN }]} pointerEvents="box-none">
      <View style={styles.barPositioner}>
        <View style={[styles.barShadowWrap, { width: barWidth }]}>
          <Svg width={barWidth} height={BAR_HEIGHT} style={StyleSheet.absoluteFill}>
            <Path d={buildBarPath(barWidth, BAR_HEIGHT)} fill={theme.card} />
          </Svg>
          <View style={styles.row}>
            <View style={styles.side}>{leftRoutes.map(renderItem)}</View>
            <View style={styles.centerGap} />
            <View style={styles.side}>{rightRoutes.map(renderItem)}</View>
          </View>
        </View>
      </View>

      {centerRoute && (
        <View style={styles.centerButtonPositioner} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              centerScale.value = withSpring(0.86, { damping: 12, stiffness: 260 }, (finished) => {
                if (finished) centerScale.value = withSpring(1, { damping: 10, stiffness: 200 });
              });
              goTo(centerRoute);
            }}
            hitSlop={10}
          >
            <Animated.View
              style={[
                styles.centerButton,
                { backgroundColor: centerFocused ? theme.primary : theme.text },
                centerAnimatedStyle,
              ]}
            >
              <Ionicons
                name={centerFocused ? 'home' : 'home-outline'}
                size={26}
                color={centerFocused ? theme.onPrimary : theme.background}
              />
            </Animated.View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: FLOAT_MARGIN,
    right: FLOAT_MARGIN,
    height: BAR_HEIGHT + CENTER_RISE,
  },
  barPositioner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  barShadowWrap: {
    height: BAR_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    flex: 1,
    flexDirection: 'row',
  },
  centerGap: {
    width: CENTER_SIZE + spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: fontSize.xs - 1,
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 8,
    fontFamily: fontFamily.bold,
    color: '#fff',
  },
  centerButtonPositioner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
});
