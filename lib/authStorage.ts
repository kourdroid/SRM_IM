import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Browser storage is scoped to the application's origin; native sessions stay encrypted.
export const authStorage = {
  getItemAsync: async (key: string): Promise<string | null> => Platform.OS === 'web'
    ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  setItemAsync: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
