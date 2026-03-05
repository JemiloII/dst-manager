import { create } from 'zustand';
import { api } from '../api';

interface PreferencesState {
  preferences: Record<string, string>;
  loaded: boolean;
  fetchPreferences: () => Promise<void>;
  setPreference: (key: string, value: string) => void;
}

export const usePreferences = create<PreferencesState>((set, get) => ({
  preferences: {},
  loaded: false,

  fetchPreferences: async () => {
    try {
      const res = await api.get('/preferences');
      if (res.ok) {
        const data = await res.json();
        set({ preferences: data, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setPreference: (key, value) => {
    const current = get().preferences;
    set({ preferences: { ...current, [key]: value } });
    api.put('/preferences', { [key]: value });
  },
}));
