import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import Text from '../../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import EmptyState from '../../src/components/ui/EmptyState';
import Badge from '../../src/components/ui/Badge';
import { useAuthStore } from '../../src/store/authStore';
import {
  getMyRegisteredCourseIDs,
  getCourses,
  listCourseMaterialsByCourse,
  getCourseMaterialDownloadUrl,
  type Course,
  type CourseMaterial,
} from '../../src/api/courses';
import * as Linking from 'expo-linking';

const TYPE_LABEL: Record<string, string> = {
  slide: 'Slide',
  past_question: 'Past Question',
  reading: 'Reading',
  other: 'Other',
};

export default function CoursesScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      const [all, registeredIds] = await Promise.all([
        getCourses(user?.level ? { level: user.level } : undefined),
        getMyRegisteredCourseIDs(),
      ]);
      const registered = new Set(registeredIds);
      setCourses(all.filter((c) => registered.has(c.id)));
    } catch {
      // keep previous state; pull-to-refresh is right there
    }
  }, [user?.level]);

  useEffect(() => {
    setLoading(true);
    fetchCourses().finally(() => setLoading(false));
  }, [fetchCourses]);

  const openCourse = async (course: Course) => {
    setSelected(course);
    setMaterialsLoading(true);
    try {
      const data = await listCourseMaterialsByCourse(course.id);
      setMaterials(data);
    } catch {
      setMaterials([]);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCourses();
    setRefreshing(false);
  };

  if (selected) {
    return (
      <Screen>
        <Pressable style={styles.backRow} onPress={() => setSelected(null)} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={theme.primary} />
          <Text style={[styles.backLabel, { color: theme.primary }]}>All Courses</Text>
        </Pressable>

        <View>
          <Text style={[styles.courseCode, { color: theme.text }]}>{selected.code}</Text>
          <Text style={[styles.courseTitle, { color: theme.textMuted }]}>{selected.title}</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Materials</Text>
        {materialsLoading ? (
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular }}>Loading...</Text>
        ) : materials.length === 0 ? (
          <Card>
            <EmptyState title="No materials yet" description="Nothing uploaded for this course yet." />
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {materials.map((m) => (
              <Card key={m.id} style={styles.materialCard}>
                <View style={styles.flex}>
                  <Text style={[styles.materialTitle, { color: theme.text }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Badge label={TYPE_LABEL[m.material_type] ?? m.material_type} tone="primary" />
                </View>
                <Pressable
                  style={[styles.downloadButton, { backgroundColor: theme.primaryMuted }]}
                  onPress={() => Linking.openURL(getCourseMaterialDownloadUrl(m.id))}
                >
                  <Ionicons name="download-outline" size={18} color={theme.primary} />
                </Pressable>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>My Courses</Text>
      {!loading && courses.length === 0 ? (
        <Card>
          <EmptyState title="No courses yet" description="You haven't registered for any courses yet." />
        </Card>
      ) : (
        <FlatList
          data={courses}
          scrollEnabled={false}
          keyExtractor={(c) => c.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Pressable onPress={() => openCourse(item)}>
                <Card style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={[styles.courseCode, { color: theme.text }]}>{item.code}</Text>
                    <Text style={[styles.courseTitle, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Badge label={`${item.unit} units`} tone="neutral" />
                  <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
                </Card>
              </Pressable>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  courseCode: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },
  courseTitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.md,
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  materialTitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
