import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Screen from '../../../src/components/ui/Screen';
import Card from '../../../src/components/ui/Card';
import Button from '../../../src/components/ui/Button';
import { changePassword } from '../../../src/api/auth';
import { getErrorMessage } from '../../../src/utils/errors';
import { haptics } from '../../../src/utils/haptics';

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggleVisible,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder="••••••••"
          placeholderTextColor={theme.textFaint}
          style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
        />
        <Pressable style={styles.eyeButton} onPress={onToggleVisible} hitSlop={12}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword) {
      setError('Fill in both fields.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      haptics.success();
      Alert.alert('Password Changed', 'Your password has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      haptics.error();
      setError(getErrorMessage(err, 'Could not change password. Check your current password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.header, { color: theme.text }]}>Change Password</Text>
      <Text style={[styles.subheader, { color: theme.textMuted }]}>
        Choose a new password with at least 8 characters.
      </Text>

      <Card style={{ gap: spacing.lg }}>
        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          visible={visible}
          onToggleVisible={() => setVisible((v) => !v)}
        />
        <PasswordField
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          visible={visible}
          onToggleVisible={() => setVisible((v) => !v)}
        />
        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          visible={visible}
          onToggleVisible={() => setVisible((v) => !v)}
        />

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted }]}>
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          </View>
        ) : null}

        <Button label="Update Password" onPress={handleSubmit} loading={saving} fullWidth size="lg" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  subheader: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: -spacing.sm,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing['3xl'],
    fontFamily: fontFamily.regular,
    fontSize: fontSize.base,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
  },
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
