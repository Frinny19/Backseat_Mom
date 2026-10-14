import 'react-native-url-polyfill/auto';

import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/** False until .env has a Supabase URL and publishable key; the app then runs on demo data. */
export const supabaseConfigured = url.startsWith('http') && key.length > 0;

// SecureStore values are limited to about 2 KB, and a Supabase session can be
// larger, so long values are split across several keys.
const CHUNK = 1800;
const secureStorage: SupportedStorage = {
  async getItem(k) {
    const count = await SecureStore.getItemAsync(`${k}.n`);
    if (count === null) return SecureStore.getItemAsync(k);
    const parts = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${k}.${i}`)),
    );
    return parts.some((p) => p === null) ? null : parts.join('');
  },
  async setItem(k, value) {
    await this.removeItem(k);
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, 'gs')) ?? [''];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${k}.${i}`, p)));
    await SecureStore.setItemAsync(`${k}.n`, String(parts.length));
  },
  async removeItem(k) {
    const count = await SecureStore.getItemAsync(`${k}.n`);
    await SecureStore.deleteItemAsync(k);
    if (count === null) return;
    await Promise.all(Array.from({ length: Number(count) }, (_, i) => SecureStore.deleteItemAsync(`${k}.${i}`)));
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};

export const supabase = createClient(supabaseConfigured ? url : 'http://localhost:54321', key || 'not-configured', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
