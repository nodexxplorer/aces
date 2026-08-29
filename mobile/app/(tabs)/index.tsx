import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import Text from '../../src/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import { palette } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import { getStudentDashboard, type StudentDashboard } from '../../src/api/dashboard';
import { getMediaUrl } from '../../src/api/client';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const cgpaHidden = useSettingsStore((s) => s.cgpaHidden);
  const setCgpaHidden = useSettingsStore((s) => s.setCgpaHidden);

  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const dashboard = await getStudentDashboard();
      setData(dashboard);
    } catch {
      // leave existing data on screen; a pull-to-refresh retry is one gesture away
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const cgpa = data?.student?.cgpa;
  const unread = data?.notifications?.unread ?? 0;

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[palette.primary[500], palette.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + spacing['2xl'] }]}
      >
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
            {getMediaUrl(user?.avatar) ? (
              <Image source={{ uri: getMediaUrl(user?.avatar)! }} style={styles.headerAvatar} resizeMode="cover" />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                <Text style={styles.headerAvatarText}>{initials(user?.firstName, user?.lastName)}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name} numberOfLines={1}>
              {user?.firstName ?? 'Student'}
            </Text>
          </View>
          <Pressable
            style={styles.bellButton}
            onPress={() => router.push('/(tabs)/communication')}
            hitSlop={10}
          >
            <Ionicons name="notifications-outline" size={22} color={palette.white} />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.cgpaCard}>
          <View>
            <View style={styles.cgpaLabelRow}>
              <Text style={styles.cgpaLabel}>Current CGPA</Text>
              <Pressable
                onPress={() => setCgpaHidden(!cgpaHidden)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={cgpaHidden ? 'Show CGPA' : 'Hide CGPA'}
              >
                <Ionicons
                  name={cgpaHidden ? 'eye-off-outline' : 'eye-outline'}
                  size={14}
                  color="rgba(255,255,255,0.8)"
                />
              </Pressable>
            </View>
            <Text style={styles.cgpaValue}>{cgpaHidden ? '••••' : cgpa != null ? cgpa.toFixed(2) : '—'}</Text>
            {data?.student?.academic_standing && (
              <Text style={styles.cgpaStanding}>{data.student.academic_standing.replace(/_/g, ' ')}</Text>
            )}
          </View>
          <View style={styles.cgpaDivider} />
          <View>
            <Text style={styles.cgpaLabel}>Level</Text>
            <Text style={styles.cgpaValue}>{data?.student?.level ?? '—'}</Text>
            <Text style={styles.cgpaStanding}>{data?.student?.matric_number ?? ''}</Text>
          </View>
        </Animated.View>
      </LinearGradient>

      <Screen refreshing={refreshing} onRefresh={onRefresh} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.statsRow}>
          <StatCard
            icon="checkmark-done-outline"
            tone="success"
            label="Attendance"
            value={`${Math.round(data?.attendance?.attendance_rate ?? 0)}%`}
          />
          <StatCard
            icon="cash-outline"
            tone="danger"
            label="Outstanding"
            value={formatCurrency(data?.payments?.amount_pending ?? 0)}
          />
          <StatCard
            icon="chatbubbles-outline"
            tone="warning"
            label="Notifications"
            value={String(unread)}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(140)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Links</Text>
          </View>
          <View style={styles.quickLinksRow}>
            <QuickLink
              icon="cash-outline"
              label="Payments"
              onPress={() => router.push('/(tabs)/payments')}
            />
            <QuickLink
              icon="notifications-outline"
              label="Updates"
              onPress={() => router.push('/(tabs)/communication')}
              badge={unread > 0 ? unread : undefined}
            />
            <QuickLink
              icon="checkmark-circle-outline"
              label="Attendance"
              onPress={() => router.push('/(tabs)/attendance')}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(260)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Announcements</Text>
          </View>
          {!loading && (data?.announcements?.length ?? 0) === 0 ? (
            <Card>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                Nothing new right now.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {(data?.announcements ?? []).slice(0, 3).map((a) => (
                <Card key={a.id}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.announcementTitle, { color: theme.text }]} numberOfLines={1}>
                      {a.title}
                    </Text>
                    {a.is_pinned && <Ionicons name="pin" size={14} color={theme.primary} />}
                  </View>
                  <Text style={[styles.announcementBody, { color: theme.textMuted }]} numberOfLines={2}>
                    {a.content}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </Animated.View>

        {(data?.recent_grades?.length ?? 0) > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(340)}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Grades</Text>
            </View>
            <Card padded={false}>
              {(data?.recent_grades ?? []).slice(0, 4).map((g, i) => (
                <View
                  key={`${g.course_code}-${i}`}
                  style={[
                    styles.gradeRow,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
                  ]}
                >
                  <View style={styles.flex}>
                    <Text style={[styles.gradeCourse, { color: theme.text }]}>{g.course_code}</Text>
                    <Text style={[styles.gradeSession, { color: theme.textFaint }]}>
                      {g.session_name} · {g.semester}
                    </Text>
                  </View>
                  <Badge
                    label={g.grade ?? String(g.score)}
                    tone={g.grade === 'F' ? 'danger' : g.grade ? 'success' : 'neutral'}
                  />
                </View>
              ))}
            </Card>
          </Animated.View>
        )}
      </Screen>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.quickLink, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={[styles.quickLinkIconWrap, { backgroundColor: theme.primaryMuted }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
        {!!badge && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.quickLinkLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'success' | 'warning' | 'danger';
  label: string;
  value: string;
}) {
  const { theme } = useTheme();
  const toneColor = { success: theme.success, warning: theme.warning, danger: theme.danger }[tone];
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: toneColor }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
  },
  headerAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.sm,
    color: palette.white,
  },
  greeting: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: palette.white,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: palette.danger[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    color: palette.white,
  },
  cgpaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  cgpaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cgpaLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.75)',
  },
  cgpaValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    color: palette.white,
    marginTop: 2,
  },
  cgpaStanding: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  cgpaDivider: {
    width: StyleSheet.hairlineWidth,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: spacing.xl,
  },
  scrollContent: {
    paddingTop: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.md,
  },
  statLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  quickLinkIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
  },
  nextClassCard: {
    gap: spacing.sm,
  },
  classCourse: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },
  classMetaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  classMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  classMetaText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  announcementTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    flex: 1,
  },
  announcementBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  gradeCourse: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  gradeSession: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});
