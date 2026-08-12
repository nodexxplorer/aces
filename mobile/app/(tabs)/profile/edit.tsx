import { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../../src/theme/typography';
import Button from '../../../src/components/ui/Button';
import { useAuthStore } from '../../../src/store/authStore';
import { updateBasicInfo } from '../../../src/api/profile';
import { getErrorMessage } from '../../../src/utils/errors';

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={[styles.input, { backgroundColor: theme.card, borderColor: theme.cardBorder, color: theme.text }]}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [homeAddress, setHomeAddress] = useState(user?.homeAddress ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName ?? '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const updated = await updateBasicInfo({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        homeAddress: homeAddress.trim() || undefined,
        dateOfBirth: dateOfBirth.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      });
      setUser({ ...user, ...updated });
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            Academic details (matric number, level) require HOD approval and aren't editable here.
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="First Name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
            </View>
            <View style={styles.flex}>
              <Field label="Last Name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            </View>
          </View>

          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="080..." keyboardType="phone-pad" />

          <Field
            label="Home Address"
            value={homeAddress}
            onChangeText={setHomeAddress}
            placeholder="Street, city, state"
          />

          <Field
            label="Date of Birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          <Field
            label="Emergency Contact Name"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            placeholder="Full name"
            autoCapitalize="words"
          />

          <Field
            label="Emergency Contact Phone"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            placeholder="080..."
            keyboardType="phone-pad"
          />

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerMuted }]}>
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Button label="Save Changes" onPress={handleSave} loading={saving} fullWidth size="lg" />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
    marginTop: spacing.sm,
  },
  headerSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
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
  errorBox: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
