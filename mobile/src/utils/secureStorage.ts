import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has no web implementation at all — there's no Keychain/
// Keystore equivalent in a browser — and throws immediately if called there.
// Web is only ever used for quick dev-browser checks, never a real target
// (Expo Go on a phone is), so localStorage is a fine, simple fallback: it
// just needs to not crash, not be genuinely secure.
const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
