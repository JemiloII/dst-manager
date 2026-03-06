type Shard = 'Master' | 'Caves';
type GameMode = 'survival' | 'endless' | 'wilderness' | 'lightsout' | 'relaxed';
type OverrideValue = string | boolean | number;

const FOREST_PRESETS: Record<GameMode, string> = {
  survival: 'SURVIVAL_TOGETHER',
  endless: 'ENDLESS',
  wilderness: 'WILDERNESS',
  lightsout: 'LIGHTS_OUT',
  relaxed: 'RELAXED',
};

// Settings overrides per preset, extracted from assets/forest.lua AddSettingsPreset calls
// SURVIVAL_TOGETHER has empty overrides (it's the baseline)
const FOREST_PRESET_OVERRIDES: Record<string, Record<string, OverrideValue>> = {
  SURVIVAL_TOGETHER: {},
  ENDLESS: {
    portalresurection: 'always',
    basicresource_regrowth: 'always',
    resettime: 'none',
    ghostsanitydrain: 'none',
  },
  WILDERNESS: {
    spawnmode: 'scatter',
    basicresource_regrowth: 'always',
    ghostenabled: 'none',
    ghostsanitydrain: 'none',
    resettime: 'none',
  },
  LIGHTS_OUT: {
    day: 'onlynight',
  },
  RELAXED: {
    ghostsanitydrain: 'none',
    portalresurection: 'always',
    temperaturedamage: 'nonlethal',
    hunger: 'nonlethal',
    darkness: 'nonlethal',
    lessdamagetaken: 'always',
    healthpenalty: 'none',
    wildfires: 'never',
    hounds: 'rare',
    resettime: 'none',
    shadowcreatures: 'rare',
    brightmarecreatures: 'rare',
  },
};

// Union of all keys that any preset controls — used to strip old preset values on game mode change
const PRESET_CONTROLLED_KEYS = new Set(
  Object.values(FOREST_PRESET_OVERRIDES).flatMap((o) => Object.keys(o))
);

export function getPresetForShard(gameMode: string, shard: Shard): string {
  if (shard === 'Caves') return 'DST_CAVE';
  return FOREST_PRESETS[gameMode as GameMode] || 'SURVIVAL_TOGETHER';
}

export function getPresetOverrides(preset: string): Record<string, OverrideValue> {
  return FOREST_PRESET_OVERRIDES[preset] || {};
}

export function getPresetControlledKeys(): Set<string> {
  return PRESET_CONTROLLED_KEYS;
}
