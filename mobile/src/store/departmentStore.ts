import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aces.department';

/** The department the user last signed in or signed up to, if they have one. */
export async function getStoredDepartment(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Remembers the department for the next sign-in. Failing to save it is harmless: the user picks again. */
export async function storeDepartment(slug: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, slug);
  } catch {
    // Not remembered; the picker starts at the default department next time.
  }
}
