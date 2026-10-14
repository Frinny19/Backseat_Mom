import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  /** Daytime ("light"), Night feed ("dark"), or follow the phone. */
  themePreference: ThemePreference;
  setThemePreference: (p: ThemePreference) => void;
};

// Kept in memory for now; Phase 1 stores it with the person's other prefs.
export const useSettings = create<SettingsState>((set) => ({
  themePreference: 'system',
  setThemePreference: (themePreference) => set({ themePreference }),
}));
