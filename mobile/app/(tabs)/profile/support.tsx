import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import { listHelpArticles, createFeedback, type HelpArticle } from '../../../src/api/support';
import { getErrorMessage } from '../../../src/utils/errors';
import { haptics } from '../../../src/utils/haptics';

const FEEDBACK_TYPES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'bug', label: 'Report a Bug', icon: 'bug-outline' },
  { key: 'feature_request', label: 'Suggest a Feature', icon: 'bulb-outline' },
  { key: 'general', label: 'General Feedback', icon: 'chatbubble-ellipses-outline' },
];

function ArticleRow({ article }: { article: HelpArticle }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        setExpanded((v) => !v);
      }}
      style={styles.articleRow}
    >
      <View style={styles.articleHeaderRow}>
        <Text style={[styles.articleTitle, styles.flex, { color: theme.text }]}>{article.title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textFaint} />
      </View>
      {expanded && <Text style={[styles.articleBody, { color: theme.textMuted }]}>{article.content}</Text>}
    </Pressable>
  );
}

export default function SupportScreen() {
  const { theme } = useTheme();
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  const [feedbackType, setFeedbackType] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listHelpArticles()
      .then((data) => setArticles(Array.isArray(data) ? data : []))
      .catch(() => setArticles([]))
      .finally(() => setLoadingArticles(false));
  }, []);

  const handleSubmitFeedback = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Add a title and description first.');
      return;
    }
    setSubmitting(true);
    try {
      await createFeedback({ feedback_type: feedbackType, title: title.trim(), description: description.trim() });
      haptics.success();
      Alert.alert('Thank You', 'Your feedback has been submitted.');
      setTitle('');
      setDescription('');
    } catch (err) {
      haptics.error();
      Alert.alert('Error', getErrorMessage(err, 'Could not submit feedback'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.header, { color: theme.text }]}>Support</Text>
      <Text style={[styles.subheader, { color: theme.textMuted }]}>Find answers or send us your feedback.</Text>

      <Animated.View entering={FadeInDown.duration(350)}>
        <Card padded={false}>
          <Text style={[styles.cardTitle, styles.cardTitlePadded, { color: theme.text }]}>
            Frequently Asked Questions
          </Text>
          {loadingArticles ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Loading...</Text>
          ) : articles.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No articles yet — send us feedback below.</Text>
          ) : (
            articles.map((a, i) => (
              <View key={a.id}>
                <ArticleRow article={a} />
                {i < articles.length - 1 && <View style={[styles.divider, { backgroundColor: theme.divider }]} />}
              </View>
            ))
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(350).delay(60)}>
        <Card style={{ gap: spacing.lg }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Send Feedback</Text>

          <View style={styles.typeRow}>
            {FEEDBACK_TYPES.map((t) => {
              const active = feedbackType === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    haptics.select();
                    setFeedbackType(t.key);
                  }}
                  style={[
                    styles.typeChip,
                    { borderColor: active ? theme.primary : theme.cardBorder, backgroundColor: active ? theme.primaryMuted : 'transparent' },
                  ]}
                >
                  <Ionicons name={t.icon} size={16} color={active ? theme.primary : theme.textMuted} />
                  <Text style={[styles.typeChipLabel, { color: active ? theme.primary : theme.text }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Short summary"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.text }]}
            />
          </View>
          <View>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell us more..."
              placeholderTextColor={theme.textFaint}
              multiline
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: theme.background, borderColor: theme.cardBorder, color: theme.text },
              ]}
            />
          </View>

          <Button label="Submit Feedback" onPress={handleSubmitFeedback} loading={submitting} fullWidth size="lg" />
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  subheader: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: -spacing.sm,
  },
  cardTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
  },
  cardTitlePadded: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    padding: spacing.lg,
    paddingTop: 0,
  },
  articleRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  articleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  articleTitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  articleBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeChipLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
});
