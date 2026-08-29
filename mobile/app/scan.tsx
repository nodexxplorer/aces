import { useState, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Text from '../src/components/ui/Text';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../src/theme/typography';
import Button from '../src/components/ui/Button';
import { selfCheckIn } from '../src/api/attendance';
import { haptics } from '../src/utils/haptics';
import { PROFILE_SCAN_PARAM } from '../src/config';

// Attendance check-in QR codes encode a plain URL (.../attendance/checkin?session=<id>) —
// any stock camera app can open them.
function extractAttendanceSessionId(data: string): string | null {
  if (!data.startsWith('http')) return null;
  try {
    const url = new URL(data);
    if (!url.pathname.includes('/attendance/checkin')) return null;
    return url.searchParams.get('session');
  } catch {
    return null;
  }
}

// A student's profile QR (see Profile screen) encodes .../connect?scan=<userId>
// — same URL shape the web app's class-rep scanner and Connect page already
// understand, so this one code works everywhere.
function extractProfileScanUserId(data: string): string | null {
  if (!data.startsWith('http')) return null;
  try {
    const url = new URL(data);
    if (!url.pathname.includes('/connect')) return null;
    return url.searchParams.get(PROFILE_SCAN_PARAM);
  } catch {
    return null;
  }
}

export default function ScanScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const lineY = useSharedValue(0);
  const lastScan = useRef<string | null>(null);

  useState(() => {
    lineY.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
    );
  });

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lineY.value * 220 }],
    opacity: 0.9,
  }));

  const handleScan = async (scan: BarcodeScanningResult) => {
    if (locked || scan.data === lastScan.current) return;
    lastScan.current = scan.data;
    setLocked(true);
    haptics.tap();

    const sessionId = extractAttendanceSessionId(scan.data);
    const scannedUserId = extractProfileScanUserId(scan.data);

    if (scannedUserId) {
      haptics.success();
      router.replace(`/connect?${PROFILE_SCAN_PARAM}=${scannedUserId}`);
      return;
    }

    if (!sessionId) {
      haptics.error();
      setResult({ ok: false, text: 'Not a recognized attendance or profile QR code.' });
      return;
    }

    try {
      await selfCheckIn(sessionId);
      haptics.success();
      setResult({ ok: true, text: 'You have been marked present.' });
    } catch (err: unknown) {
      haptics.error();
      const message =
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not verify this QR code.';
      setResult({ ok: false, text: message });
    }
  };

  const reset = () => {
    lastScan.current = null;
    setResult(null);
    setLocked(false);
  };

  if (!permission) {
    return <View style={[styles.flex, { backgroundColor: '#000' }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: theme.background, padding: spacing.xl }]}>
        <Ionicons name="camera-outline" size={48} color={theme.textFaint} />
        <Text style={[styles.permTitle, { color: theme.text }]}>Camera access needed</Text>
        <Text style={[styles.permBody, { color: theme.textMuted }]}>
          Scan attendance or student profile QR codes.
        </Text>
        <Button label="Grant Permission" onPress={requestPermission} size="lg" />
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: theme.textMuted, fontFamily: fontFamily.medium }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : handleScan}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + spacing.md }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.overlayTitle}>Scan QR Code</Text>
        <Text style={styles.overlaySubtitle}>Scan an attendance or student profile QR code</Text>

        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            <Animated.View style={[styles.scanLine, scanLineStyle, { backgroundColor: theme.primary }]} />
          </View>
        </View>
      </View>

      {result && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.resultBackdrop}>
          <Animated.View
            entering={FadeInDown.duration(350).springify()}
            style={[styles.resultCard, { backgroundColor: theme.card }]}
          >
            <View
              style={[
                styles.resultIconWrap,
                { backgroundColor: result.ok ? theme.successMuted : theme.dangerMuted },
              ]}
            >
              <Ionicons
                name={result.ok ? 'checkmark-circle' : 'close-circle'}
                size={36}
                color={result.ok ? theme.success : theme.danger}
              />
            </View>
            <Text style={[styles.resultTitle, { color: theme.text }]}>{result.ok ? 'Success' : 'Scan Failed'}</Text>
            <Text style={[styles.resultBody, { color: theme.textMuted }]}>{result.text}</Text>
            <View style={styles.resultActions}>
              <View style={styles.flex}>
                <Button label="Scan Again" variant="outline" onPress={reset} fullWidth />
              </View>
              <View style={styles.flex}>
                <Button label="Done" onPress={() => router.back()} fullWidth />
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  permTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, marginTop: spacing.sm },
  permBody: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.md },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  closeButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: '#fff',
    marginTop: spacing.lg,
  },
  overlaySubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  frameWrap: {
    marginTop: spacing['3xl'],
    width: 240,
    height: 240,
    alignItems: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
  scanLine: {
    height: 2,
    width: '100%',
  },
  resultBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  resultCard: {
    width: '100%',
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
  },
  resultIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  resultTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
  },
  resultBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
});
