import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function getBiometricLabel(): Promise<string> {
  if (Platform.OS === 'web') return 'Biometric Login';
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris Scan';
  return 'Biometric Login';
}

export async function authenticateWithBiometrics(promptMessage = 'Unlock ACES Zone'): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
