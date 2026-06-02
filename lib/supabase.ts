import { createClient } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export function isSupabaseNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('authretryablefetcherror') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  );
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found') ||
    message.includes('refresh token has already been used')
  );
}

export function isAuthSessionMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('auth session missing') || message.includes('session missing');
}

export function toSupabaseUserMessage(error: unknown): string {
  if (isSupabaseNetworkError(error)) {
    return 'Connexion Supabase indisponible. Vérifiez Internet puis réessayez.';
  }

  if (isInvalidRefreshTokenError(error) || isAuthSessionMissingError(error)) {
    return 'Session expirée. Veuillez vous reconnecter.';
  }

  return error instanceof Error ? error.message : 'Une erreur inconnue est survenue.';
}

export async function hasRemoteNetwork(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

const nativeFetch = globalThis.fetch.bind(globalThis);

const supabaseFetch: typeof fetch = async (input, init) => {
  try {
    return await nativeFetch(input, init);
  } catch (error) {
    if (isSupabaseNetworkError(error)) {
      throw new Error(`Network request failed while reaching Supabase (${new URL(supabaseUrl).host}).`);
    }
    throw error;
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function clearLocalSupabaseSession(): Promise<void> {
  supabase.auth.stopAutoRefresh();

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    const projectRef = new URL(supabaseUrl).host.split('.')[0];
    await SecureStore.deleteItemAsync(`sb-${projectRef}-auth-token`).catch(() => undefined);
  }
}

export async function handleInvalidSupabaseSession(error: unknown): Promise<boolean> {
  if (!isInvalidRefreshTokenError(error) && !isAuthSessionMissingError(error)) return false;
  await clearLocalSupabaseSession();
  return true;
}

async function syncAutoRefreshWithNetwork(): Promise<void> {
  if (!(await hasRemoteNetwork())) {
    supabase.auth.stopAutoRefresh();
    return;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    if (session) {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  } catch (error) {
    if (await handleInvalidSupabaseSession(error)) return;
    if (isSupabaseNetworkError(error)) {
      supabase.auth.stopAutoRefresh();
      return;
    }
    throw error;
  }
}

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void syncAutoRefreshWithNetwork();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

Network.addNetworkStateListener((state) => {
  if (state.isConnected && state.isInternetReachable !== false) {
    void syncAutoRefreshWithNetwork();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
