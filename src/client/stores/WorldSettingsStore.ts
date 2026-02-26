import { create } from 'zustand';
import Settings from '../data/Settings.json';

interface WorldSettingsStore {
  // Store the actual selected options by override key
  selections: Record<string, string>;
  
  // Set a specific selection
  setSelection: (override: string, option: string) => void;
  
  // Cycle to next/previous option
  cycleSelection: (override: string, direction: 'next' | 'prev') => void;
  
  // Get the current mapping value for an override
  getMappingValue: (override: string) => string | undefined;
  
  // Load selections from server data (mappings to options)
  loadFromMappings: (mappings: Record<string, string>) => void;
  
  // Get all mappings for saving
  getAllMappings: () => Record<string, string>;
  
  // Reset selections
  reset: () => void;
}

export const useWorldSettingsStore = create<WorldSettingsStore>((set, get) => ({
  selections: {},
  
  setSelection: (override, option) => {
    set((state) => ({
      selections: {
        ...state.selections,
        [override]: option
      }
    }));
  },
  
  cycleSelection: (override, direction) => {
    const setting = findSetting(override);
    if (!setting) return;
    
    const currentOption = get().selections[override] || setting.options[setting.options.indexOf('Default')] || setting.options[0];
    const currentIndex = setting.options.indexOf(currentOption);
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % setting.options.length;
    } else {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = setting.options.length - 1;
    }
    
    get().setSelection(override, setting.options[newIndex]);
  },
  
  getMappingValue: (override) => {
    const setting = findSetting(override);
    if (!setting) return undefined;
    
    const selectedOption = get().selections[override];
    if (!selectedOption) return setting.mappings[setting.options.indexOf('Default')] || setting.mappings[0];
    
    const index = setting.options.indexOf(selectedOption);
    return index !== -1 ? setting.mappings[index] : undefined;
  },
  
  loadFromMappings: (mappings) => {
    const newSelections: Record<string, string> = {};
    
    for (const [override, mappingValue] of Object.entries(mappings)) {
      const setting = findSetting(override);
      if (setting) {
        const index = setting.mappings.indexOf(mappingValue);
        if (index !== -1) {
          newSelections[override] = setting.options[index];
        }
      }
    }
    
    set({ selections: newSelections });
  },
  
  getAllMappings: () => {
    const mappings: Record<string, string> = {};
    const state = get();
    
    // Get all unique overrides from Settings
    const allOverrides = new Set<string>();
    const settingsData = Settings as any;
    
    for (const shard of ['Forest', 'Caves']) {
      for (const tab of ['Settings', 'Generation']) {
        const tabData = settingsData[shard]?.[tab];
        if (tabData) {
          for (const group of Object.values(tabData)) {
            for (const setting of group as any[]) {
              allOverrides.add(setting.override);
            }
          }
        }
      }
    }
    
    // Convert selections to mappings
    for (const override of allOverrides) {
      const value = state.getMappingValue(override);
      if (value) {
        mappings[override] = value;
      }
    }
    
    return mappings;
  },
  
  reset: () => {
    set({ selections: {} });
  }
}));

// Helper to find a setting by override key
function findSetting(override: string) {
  const settingsData = Settings as any;
  
  for (const shard of ['Forest', 'Caves']) {
    for (const tab of ['Settings', 'Generation']) {
      const tabData = settingsData[shard]?.[tab];
      if (tabData) {
        for (const group of Object.values(tabData)) {
          for (const setting of group as any[]) {
            if (setting.override === override) {
              return setting;
            }
          }
        }
      }
    }
  }
  
  return null;
}