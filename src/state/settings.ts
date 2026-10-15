import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  /** Daytime ("light"), Night feed ("dark"), or follow the phone. */
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;
};

const KEY = 'settings:theme';

function readTheme(): ThemePreference {
  try {
    const v = Storage.getItemSync(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Per-phone settings, kept on the device. */
export const useSettings = create<SettingsState>((set) => ({
  themePreference: readTheme(),
  setThemePreference: (themePreference) => {
    set({ themePreference });
    try {
      Storage.setItemSync(KEY, themePreference);
    } catch {
      // Not saved; it still applies until the app closes.
    }
  },
}));
