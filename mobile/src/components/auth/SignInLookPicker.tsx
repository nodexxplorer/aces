import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Text from '../ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../theme/typography';
import {
  DIM_LEVELS,
  LOGIN_TEMPLATES,
  MAX_SAVED_WALLPAPERS,
  type DimLevel,
  type LoginTemplate,
} from '../../config/signInLook';
import { createWallpaper } from '../../api/wallpapers';
import { getErrorMessage } from '../../utils/errors';
import { keepCreatedImage, keepLookImage, pickLookImage } from '../../utils/signInLookImage';
import type { SignInLookControls } from '../../hooks/useSignInLook';

const MAX_PROMPT = 300;

/**
 * The look controls on the sign-in and sign-up screens. Anyone can use them. The
 * choices stay on this phone: the template, the wallpaper (uploaded from the
 * phone or created from a description) and how dim it is.
 */
export default function SignInLookPicker({ controls }: { controls: SignInLookControls }) {
  const { look, library, wallpaper, setTemplate, setDim, saveWallpaper, selectWallpaper, deleteWallpaper } = controls;
  const { theme } = useTheme();
  const [busy, setBusy] = useState<'upload' | 'create' | null>(null);
  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const needsWallpaper = look.template !== 'classic';

  const pickTemplate = async (template: LoginTemplate) => {
    if (template === look.template) return;
    if (!(await setTemplate(template))) {
      Alert.alert('Could not save the look', 'This phone could not keep it. Free some storage and try again.');
    }
  };

  const pickDim = async (dim: DimLevel) => {
    if (dim === look.dim) return;
    if (!(await setDim(dim))) Alert.alert('Could not save the look', 'This phone could not keep it.');
  };

  const addFromPhone = async () => {
    setBusy('upload');
    try {
      const picked = await pickLookImage();
      if (!picked) return;
      const kept = await keepLookImage(picked);
      if (!(await saveWallpaper(kept, 'upload'))) {
        Alert.alert('Wallpaper not added', 'This phone has no room for it. Free some storage and try again.');
      }
    } catch (err) {
      Alert.alert('Wallpaper not added', err instanceof Error ? err.message : 'This image could not be used. Try a PNG or JPEG.');
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    const text = prompt.trim();
    if (!text) return;
    setBusy('create');
    try {
      const made = await createWallpaper(text);
      const kept = await keepCreatedImage(made.mimeType, made.data);
      if (await saveWallpaper(kept, 'created')) {
        setPrompt('');
        setCreating(false);
      } else {
        Alert.alert('Wallpaper not kept', 'This phone has no room for it. Remove a saved one and try again.');
      }
    } catch (err) {
      Alert.alert('Could not create the wallpaper', getErrorMessage(err, 'Try again in a moment.'));
    } finally {
      setBusy(null);
    }
  };

  const removeCurrent = async () => {
    if (!wallpaper) return;
    if (!(await deleteWallpaper(wallpaper.id))) Alert.alert('Could not remove the wallpaper', 'Please try again.');
  };

  const option = (selected: boolean) => ({
    backgroundColor: selected ? theme.primary : theme.primaryMuted,
  });

  return (
    <View style={[styles.box, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.textMuted }]}>Look</Text>
        <Text style={[styles.note, { color: theme.textMuted }]}>Saved on this phone</Text>
      </View>

      <View accessibilityRole="radiogroup" style={styles.row}>
        {LOGIN_TEMPLATES.map((item) => {
          const selected = look.template === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={item.label}
              accessibilityHint={item.description}
              onPress={() => pickTemplate(item.id)}
              style={[styles.option, option(selected)]}
            >
              <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {needsWallpaper ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={[styles.note, { color: theme.textMuted }]}>Wallpaper</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload"
              disabled={busy !== null}
              onPress={addFromPhone}
              style={[styles.action, { backgroundColor: theme.primaryMuted, opacity: busy ? 0.6 : 1 }]}
            >
              {busy === 'upload' ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.actionText, { color: theme.primary }]}>Upload</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create"
              accessibilityState={{ expanded: creating }}
              disabled={busy !== null}
              onPress={() => setCreating((v) => !v)}
              style={[styles.action, { backgroundColor: theme.primaryMuted, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={[styles.actionText, { color: theme.primary }]}>Create</Text>
            </Pressable>
          </View>

          {creating ? (
            <View style={styles.createBox}>
              <TextInput
                value={prompt}
                onChangeText={setPrompt}
                maxLength={MAX_PROMPT}
                editable={busy === null}
                placeholder="e.g. a lecture hall at sunset"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel="Describe the wallpaper"
                style={[styles.input, { color: theme.text, borderColor: theme.cardBorder, backgroundColor: theme.background }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create wallpaper"
                disabled={busy !== null || prompt.trim() === ''}
                onPress={create}
                style={[styles.action, { backgroundColor: theme.primary, opacity: busy !== null || prompt.trim() === '' ? 0.6 : 1 }]}
              >
                <Text style={[styles.actionText, { color: '#ffffff' }]}>
                  {busy === 'create' ? 'Creating…' : 'Create wallpaper'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {library.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                Saved ({library.length} of {MAX_SAVED_WALLPAPERS})
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.thumbs} accessibilityRole="radiogroup">
                  {library.map((item, index) => {
                    const selected = look.wallpaperId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`Saved wallpaper ${index + 1}${item.source === 'created' ? ', created' : ''}`}
                        onPress={async () => {
                          if (!(await selectWallpaper(item.id))) Alert.alert('Could not save the look', 'Please try again.');
                        }}
                        style={[
                          styles.thumb,
                          { borderColor: selected ? theme.primary : 'transparent' },
                        ]}
                      >
                        <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {wallpaper ? (
            <>
              <View accessibilityRole="radiogroup" style={styles.row}>
                {DIM_LEVELS.map((level) => {
                  const selected = look.dim === level.id;
                  return (
                    <Pressable
                      key={level.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${level.label} dim`}
                      onPress={() => pickDim(level.id)}
                      style={[styles.option, option(selected)]}
                    >
                      <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>{level.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable accessibilityRole="button" onPress={removeCurrent} style={styles.linkButton}>
                <Text style={[styles.actionText, { color: theme.textMuted }]}>Remove this wallpaper from the phone</Text>
              </Pressable>
            </>
          ) : (
            <Text style={[styles.note, { color: theme.textMuted }]}>
              This look uses a wallpaper. Upload or create one to see it.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  note: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  optionText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  action: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  createBox: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  thumbs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
