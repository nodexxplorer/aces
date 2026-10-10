import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Text from '../ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../theme/typography';
import { LOGIN_TEMPLATES, type LoginTemplate, type SignInLook } from '../../config/signInLook';
import { pickSignInImage } from '../../utils/signInLookImage';

interface Props {
  slug: string;
  look: SignInLook;
  onTemplate: (template: LoginTemplate) => Promise<boolean>;
  onImage: (imageUri: string) => Promise<boolean>;
  onRemoveImage: () => Promise<boolean>;
}

/**
 * The template choice on the sign-in and sign-up screens. Anyone can change it;
 * the choice stays on this phone. Split and centered need a picture, so the
 * picker says so until one is added.
 */
export default function SignInLookPicker({ slug, look, onTemplate, onImage, onRemoveImage }: Props) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const needsImage = look.template !== 'classic';

  const pick = async (template: LoginTemplate) => {
    if (template === look.template) return;
    if (!(await onTemplate(template))) {
      Alert.alert('Could not save the look', 'This phone could not keep it. Free some storage and try again.');
    }
  };

  const addImage = async () => {
    setBusy(true);
    try {
      const uri = await pickSignInImage(slug);
      if (!uri) return;
      if (!(await onImage(uri))) {
        Alert.alert('Image not added', 'This phone has no room for it. Try again after freeing some storage.');
      }
    } catch (err) {
      Alert.alert('Image not added', err instanceof Error ? err.message : 'This image could not be used. Try a PNG or JPEG.');
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async () => {
    if (!(await onRemoveImage())) {
      Alert.alert('Could not remove the image', 'Please try again.');
    }
  };

  return (
    <View style={[styles.box, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: theme.textMuted }]}>Look</Text>
        <Text style={[styles.note, { color: theme.textMuted }]}>Saved on this phone</Text>
      </View>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {LOGIN_TEMPLATES.map((option) => {
          const selected = look.template === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              accessibilityHint={option.description}
              onPress={() => pick(option.id)}
              style={[
                styles.option,
                { backgroundColor: selected ? theme.primary : theme.primaryMuted },
              ]}
            >
              <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.imageRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={look.imageUri ? 'Replace image' : 'Add image'}
          disabled={busy}
          onPress={addImage}
          style={[styles.action, { backgroundColor: theme.primaryMuted, opacity: busy ? 0.6 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.actionText, { color: theme.primary }]}>
              {look.imageUri ? 'Replace image' : 'Add image'}
            </Text>
          )}
        </Pressable>
        {look.imageUri ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Remove image" onPress={removeImage} style={styles.action}>
            <Text style={[styles.actionText, { color: theme.textMuted }]}>Remove image</Text>
          </Pressable>
        ) : null}
      </View>

      {needsImage && !look.imageUri ? (
        <Text style={[styles.note, { color: theme.textMuted }]}>This look uses an image. Add one to see it.</Text>
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
  options: {
    flexDirection: 'row',
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
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
});
