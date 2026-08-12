import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize } from '../../src/theme/typography';

type IconName = keyof typeof Ionicons.glyphMap;

// React Navigation's tabBarIcon hands back a ColorValue (it supports
// platform-specific opaque colors); every color in our theme is always a
// plain hex/rgba string, so the cast here is safe.
function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color as string} />;
}

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarStyle: {
          backgroundColor: theme.backgroundElevated,
          borderTopColor: theme.divider,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.medium,
          fontSize: fontSize.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Courses',
          tabBarIcon: ({ color, focused }) => <TabIcon name="book" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color, focused }) => <TabIcon name="card" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="manuals"
        options={{
          title: 'Manuals',
          tabBarIcon: ({ color, focused }) => <TabIcon name="library" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="communication"
        options={{
          title: 'Updates',
          tabBarIcon: ({ color, focused }) => <TabIcon name="notifications" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
