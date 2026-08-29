import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useUnreadStore } from '../../src/store/unreadStore';
import ChatbotFAB from '../../src/components/ChatbotFAB';
import FloatingTabBar from '../../src/components/FloatingTabBar';

const UNREAD_POLL_INTERVAL_MS = 60000;

export default function TabsLayout() {
  const totalUnreadMessages = useUnreadStore((s) => s.totalUnreadMessages);
  const refreshUnread = useUnreadStore((s) => s.refresh);

  // The Connect screen pushes its own fetch results in directly when it's
  // open (see connect/index.tsx); this polling keeps the badge fresh the
  // rest of the time, when Connect isn't the active screen to do that.
  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, UNREAD_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  return (
    <>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // Built-in cross-fade + slide when switching tabs, instead of the
          // default instant cut.
          animation: 'shift',
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
        <Tabs.Screen name="payments" options={{ title: 'Payments' }} />
        <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
        <Tabs.Screen
          name="connect"
          options={{
            title: 'Connect',
            tabBarBadge: totalUnreadMessages > 0 ? totalUnreadMessages : undefined,
          }}
        />
        {/* Reachable from the Home header avatar, not as a bottom tab — href:
            null keeps the route registered (so router.push still works)
            without giving it a tab bar item. */}
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="communication" options={{ href: null }} />
      </Tabs>
      <ChatbotFAB />
    </>
  );
}
