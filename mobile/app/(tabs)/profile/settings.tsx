import * as Crypto from "expo-crypto";
import { registerForPushNotificationsAsync } from "../../../src/utils/pushNotifications";
import {
  registerPushToken,
  notificationDeliverySetup,
  sendNotificationTest,
  notificationTestStatus,
  type DeliverySetup,
} from "../../../src/api/notifications";
import { useAuthStore } from "../../../src/store/authStore";
import { useEffect, useState } from "react";
import {
  View,
  Text as RNText,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  Linking,
} from "react-native";
import Text from "../../../src/components/ui/Text";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "../../../src/theme/ThemeProvider";
import {
  fontFamily,
  fontSize,
  radius,
  spacing,
} from "../../../src/theme/typography";
import Screen from "../../../src/components/ui/Screen";
import Card from "../../../src/components/ui/Card";
import {
  useSettingsStore,
  FONT_SCALE_LABELS,
  FONT_SCALE_VALUES,
  type ThemeMode,
  type FontScaleKey,
} from "../../../src/store/settingsStore";
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  getBiometricLabel,
} from "../../../src/utils/biometrics";
import { haptics } from "../../../src/utils/haptics";
import {
  getPreferences,
  updatePreferences,
  type NotificationPreferences,
} from "../../../src/api/notifications";

const THEME_OPTIONS: {
  key: ThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "system", label: "System", icon: "phone-portrait-outline" },
  { key: "light", label: "Light", icon: "sunny-outline" },
  { key: "dark", label: "Dark", icon: "moon-outline" },
];

const FONT_SCALE_ORDER: FontScaleKey[] = [
  "small",
  "default",
  "large",
  "xlarge",
];

function SectionTitle({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: theme.textFaint }]}>
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useSettingsStore((s) => s.setBiometricEnabled);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometric Login");
  const [bioBusy, setBioBusy] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(
    null,
  );
  const [delivery, setDelivery] = useState<DeliverySetup | null>(null);
  const [testId, setTestId] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [notifBusyField, setNotifBusyField] = useState<string | null>(null);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
    getBiometricLabel().then(setBioLabel);
    notificationDeliverySetup()
      .then(setDelivery)
      .catch(() => {});
    getPreferences()
      .then(setNotifPrefs)
      .catch(() => {});
  }, []);

  const handleToggleNotifChannel = async (
    field: "email_enabled" | "push_enabled" | "in_app_enabled",
    value: boolean,
  ) => {
    if (!notifPrefs) return;
    const previous = notifPrefs;
    // Keep the visible preference snapshot synchronized with this channel edit.
    const next = { ...notifPrefs, [field]: value };
    setNotifPrefs(next);
    setNotifBusyField(field);
    try {
      if (field === "push_enabled" && value) {
        const token = await registerForPushNotificationsAsync();
        if (!token)
          throw new Error(
            "Push needs permission and a physical-device development/production build. Check device notification settings.",
          );
        await registerPushToken(token);
      }
      const updated = await updatePreferences(next);
      setNotifPrefs(updated);
    } catch (e) {
      Alert.alert(
        "Could not update notifications",
        e instanceof Error ? e.message : "Please try again.",
      );
      setNotifPrefs(previous);
      haptics.error();
    } finally {
      setNotifBusyField(null);
    }
  };

  async function testNotifications(refresh = false) {
    setTestBusy(true);
    try {
      let id = testId;
      if (!refresh || !id) {
        id = Crypto.randomUUID();
        await sendNotificationTest(id);
        setTestId(id);
      }
      const report = await notificationTestStatus(id);
      setTestMessage(
        report.channels.length
          ? report.channels
              .map(
                (c) =>
                  `${c.channel}: ${c.status}${c.detail ? ` (${c.detail})` : ""}`,
              )
              .join(" · ")
          : "No channel jobs. Enable the System topic on the web and register a push device.",
      );
    } catch (e) {
      setTestMessage(
        e instanceof Error
          ? e.message
          : "Test failed; no delivery is confirmed.",
      );
    } finally {
      setTestBusy(false);
    }
  }
  const handleToggleBiometric = async (value: boolean) => {
    if (!value) {
      setBiometricEnabled(false);
      return;
    }
    if (!bioAvailable) {
      Alert.alert(
        `${bioLabel} Unavailable`,
        "Set up Face ID, Touch ID, or a fingerprint in your device settings first.",
      );
      return;
    }
    setBioBusy(true);
    const ok = await authenticateWithBiometrics(
      `Confirm to enable ${bioLabel}`,
    );
    setBioBusy(false);
    if (ok) {
      haptics.success();
      setBiometricEnabled(true);
    } else {
      haptics.error();
    }
  };

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString();

  return (
    <Screen>
      <Text style={[styles.header, { color: theme.text }]}>Settings</Text>

      <Animated.View entering={FadeInDown.duration(350)}>
        <SectionTitle>Appearance</SectionTitle>
        <Card padded={false}>
          <View style={styles.chipRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    haptics.select();
                    setThemeMode(opt.key);
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.primary : theme.cardBorder,
                      backgroundColor: active
                        ? theme.primaryMuted
                        : "transparent",
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={active ? theme.primary : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: active ? theme.primary : theme.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(40)}>
        <SectionTitle>Text Size</SectionTitle>
        <Card padded={false}>
          <View style={styles.chipRow}>
            {FONT_SCALE_ORDER.map((key) => {
              const active = fontScale === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    haptics.select();
                    setFontScale(key);
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.primary : theme.cardBorder,
                      backgroundColor: active
                        ? theme.primaryMuted
                        : "transparent",
                    },
                  ]}
                >
                  {/* Fixed to each option's own ratio, deliberately not the
                      live global scale — these four swatches preview what
                      "Small" vs "Large" etc. looks like side by side. */}
                  <RNText
                    style={[
                      styles.fontPreview,
                      {
                        color: active ? theme.primary : theme.text,
                        fontSize: 13 * FONT_SCALE_VALUES[key],
                      },
                    ]}
                  >
                    Aa
                  </RNText>
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: active ? theme.primary : theme.text },
                    ]}
                  >
                    {FONT_SCALE_LABELS[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={[
              styles.previewText,
              { color: theme.textMuted, fontSize: fontSize.sm },
            ]}
          >
            This is how body text will look across the app.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(80)}>
        <SectionTitle>Security</SectionTitle>
        <Card padded={false}>
          <View style={styles.switchRow}>
            <View
              style={[
                styles.rowIconWrap,
                { backgroundColor: theme.primaryMuted },
              ]}
            >
              <Ionicons
                name="finger-print-outline"
                size={18}
                color={theme.primary}
              />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>
                {bioLabel}
              </Text>
              <Text style={[styles.rowHint, { color: theme.textFaint }]}>
                {bioAvailable
                  ? "Lock the app and unlock with biometrics"
                  : "Not set up on this device"}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              disabled={bioBusy}
              trackColor={{ true: theme.primary }}
            />
          </View>
          <View
            style={[styles.menuDivider, { backgroundColor: theme.divider }]}
          />
          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => {
              haptics.select();
              router.push("/profile/change-password");
            }}
          >
            <View
              style={[
                styles.rowIconWrap,
                { backgroundColor: theme.primaryMuted },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.rowLabel, styles.flex, { color: theme.text }]}>
              Change Password
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.textFaint}
            />
          </Pressable>
        </Card>
      </Animated.View>

      {notifPrefs && (
        <Animated.View entering={FadeInDown.duration(350).delay(110)}>
          <SectionTitle>Notifications</SectionTitle>
          <Text style={{ color: theme.textMuted }}>
            Email: {delivery?.email_mode || "checking"} · Push:{" "}
            {delivery?.push_mode || "checking"}. Quiet hours use Africa/Lagos.
            Topic and quiet-hour settings are available on the website.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={testBusy}
            onPress={() => void testNotifications()}
          >
            <Text style={{ color: theme.primary }}>
              Send real notification test
            </Text>
          </Pressable>
          {!!testId && (
            <Pressable
              accessibilityRole="button"
              disabled={testBusy}
              onPress={() => void testNotifications(true)}
            >
              <Text style={{ color: theme.primary }}>Refresh test status</Text>
            </Pressable>
          )}
          {!!testMessage && (
            <Text style={{ color: theme.textMuted }}>
              {testMessage} Accepted means provider acceptance, not confirmed
              delivery. Simulated means no external send.
            </Text>
          )}
          <Card padded={false}>
            <View style={styles.switchRow}>
              <View
                style={[
                  styles.rowIconWrap,
                  { backgroundColor: theme.primaryMuted },
                ]}
              >
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={theme.primary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  In-App Notifications
                </Text>
                <Text style={[styles.rowHint, { color: theme.textFaint }]}>
                  Show notifications inside the app
                </Text>
              </View>
              <Switch
                value={notifPrefs.in_app_enabled}
                onValueChange={(v) =>
                  handleToggleNotifChannel("in_app_enabled", v)
                }
                disabled={notifBusyField === "in_app_enabled"}
                trackColor={{ true: theme.primary }}
              />
            </View>
            <View
              style={[styles.menuDivider, { backgroundColor: theme.divider }]}
            />
            <View style={styles.switchRow}>
              <View
                style={[
                  styles.rowIconWrap,
                  { backgroundColor: theme.primaryMuted },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={theme.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  Email Notifications
                </Text>
                <Text style={[styles.rowHint, { color: theme.textFaint }]}>
                  Receive notifications by email
                </Text>
              </View>
              <Switch
                value={notifPrefs.email_enabled}
                onValueChange={(v) =>
                  handleToggleNotifChannel("email_enabled", v)
                }
                disabled={notifBusyField === "email_enabled"}
                trackColor={{ true: theme.primary }}
              />
            </View>
            <View
              style={[styles.menuDivider, { backgroundColor: theme.divider }]}
            />
            <View style={styles.switchRow}>
              <View
                style={[
                  styles.rowIconWrap,
                  { backgroundColor: theme.primaryMuted },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={theme.primary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.rowLabel, { color: theme.text }]}>
                  Push Notifications
                </Text>
                <Text style={[styles.rowHint, { color: theme.textFaint }]}>
                  Receive push alerts on this device
                </Text>
              </View>
              <Switch
                value={notifPrefs.push_enabled}
                onValueChange={(v) =>
                  handleToggleNotifChannel("push_enabled", v)
                }
                disabled={notifBusyField === "push_enabled"}
                trackColor={{ true: theme.primary }}
              />
            </View>
          </Card>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.duration(350).delay(120)}>
        <SectionTitle>About</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.aboutRow}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>
              Admin Pack
            </Text>
            <Text style={[styles.rowHint, { color: theme.textFaint }]}>
              Version {appVersion}
              {buildNumber ? ` (${buildNumber})` : ""}
            </Text>
          </View>
          <Text style={[styles.aboutBody, { color: theme.textMuted }]}>
            {user?.tenant?.name ?? "Admin Pack"}.
          </Text>
          <Pressable
            onPress={() =>
              Linking.openURL("https://aces-ivory.vercel.app").catch(() => {})
            }
            style={styles.aboutLinkRow}
          >
            <Ionicons name="globe-outline" size={16} color={theme.primary} />
            <Text style={[styles.aboutLinkText, { color: theme.primary }]}>
              Visit the Admin Pack website
            </Text>
          </Pressable>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize["2xl"],
  },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  fontPreview: {
    fontFamily: fontFamily.bold,
  },
  previewText: {
    fontFamily: fontFamily.regular,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  rowHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 34 + spacing.md,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  aboutBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  aboutLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  aboutLinkText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
