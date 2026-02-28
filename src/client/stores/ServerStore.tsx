import { create } from 'zustand';
import { api } from '../api';

interface ServerConfig {
  name: string;
  description: string;
  game_mode: string;
  max_players: number;
  pvp: boolean;
  password: string;
}

interface WorldSettings {
  forest: any;
  caves: any;
}

interface ModSettings {
  enabled: string[];
  configs: Record<string, any>;
}

interface ServerState {
  // Current server data
  server: any | null;
  
  // Pending changes
  configChanges: Partial<ServerConfig> | null;
  worldChanges: Partial<WorldSettings> | null;
  modChanges: Partial<ModSettings> | null;
  
  // Track if there are unsaved changes
  hasUnsavedChanges: boolean;
  
  // Actions
  setServer: (server: any) => void;
  updateConfig: (changes: Partial<ServerConfig>) => void;
  updateWorld: (changes: Partial<WorldSettings>) => void;
  updateMods: (changes: Partial<ModSettings>) => void;
  
  // Save all changes
  saveAll: (code: string) => Promise<void>;
  
  // Reset changes
  resetChanges: () => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  server: null,
  configChanges: null,
  worldChanges: null,
  modChanges: null,
  hasUnsavedChanges: false,
  
  setServer: (server) => set({ server }),
  
  updateConfig: (changes) => set((state) => ({
    configChanges: { ...state.configChanges, ...changes },
    hasUnsavedChanges: true
  })),
  
  updateWorld: (changes) => set((state) => ({
    worldChanges: { ...state.worldChanges, ...changes },
    hasUnsavedChanges: true
  })),
  
  updateMods: (changes) => set((state) => ({
    modChanges: { ...state.modChanges, ...changes },
    hasUnsavedChanges: true
  })),
  
  saveAll: async (code: string) => {
    const state = get();
    const promises: Promise<any>[] = [];
    
    // Save config changes
    if (state.configChanges) {
      const body = {
        name: state.configChanges.name ?? state.server?.name,
        description: state.configChanges.description ?? state.server?.description,
        game_mode: state.configChanges.game_mode ?? state.server?.game_mode,
        max_players: state.configChanges.max_players ?? state.server?.max_players,
        pvp: state.configChanges.pvp !== undefined ? (state.configChanges.pvp ? 1 : 0) : state.server?.pvp,
        password: state.configChanges.password ?? state.server?.password,
      };
      promises.push(api.put(`/servers/${code}`, body));
    }
    
    // Save world settings
    if (state.worldChanges) {
      if (state.worldChanges.forest) {
        promises.push(api.put(`/servers/${code}/world/forest/settings`, state.worldChanges.forest));
      }
      if (state.worldChanges.caves) {
        promises.push(api.put(`/servers/${code}/world/caves/settings`, state.worldChanges.caves));
      }
    }
    
    // Save mod settings
    if (state.modChanges) {
      if (state.modChanges.enabled) {
        promises.push(api.post(`/servers/${code}/mods`, { mods: state.modChanges.enabled }));
      }
      if (state.modChanges.configs) {
        for (const [modId, config] of Object.entries(state.modChanges.configs)) {
          promises.push(api.put(`/servers/${code}/mods/${modId}/config`, config));
        }
      }
    }
    
    // Execute all saves
    await Promise.all(promises);
    
    // Clear pending changes
    set({
      configChanges: null,
      worldChanges: null,
      modChanges: null,
      hasUnsavedChanges: false
    });
    
    // Refresh server data
    const res = await api.get(`/servers/${code}`);
    if (res.ok) {
      const server = await res.json();
      set({ server });
    }
  },
  
  resetChanges: () => set({
    configChanges: null,
    worldChanges: null,
    modChanges: null,
    hasUnsavedChanges: false
  })
}));