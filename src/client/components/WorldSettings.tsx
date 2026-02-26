import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import settingsConfig from '../../../settings.json';
import { WORLDSETTINGS_ICONS, WORLDGEN_ICONS } from '../data/worldSettingsMap';
import { getLuaKey } from '../data/settingsMapping';

const VALUE_OPTIONS = ['never', 'rare', 'default', 'often', 'always'];
const SEASON_OPTIONS = ['noseason', 'veryshortseason', 'shortseason', 'default', 'longseason', 'verylongseason'];

interface SettingOption {
  value: string;
  label: string;
}

const SETTING_LABELS: Record<string, SettingOption[]> = {
  default: [
    { value: 'never', label: 'None' },
    { value: 'rare', label: 'Less' },
    { value: 'default', label: 'Default' },
    { value: 'often', label: 'More' },
    { value: 'always', label: 'Lots' },
  ],
  season: [
    { value: 'noseason', label: 'None' },
    { value: 'veryshortseason', label: 'Very Short' },
    { value: 'shortseason', label: 'Short' },
    { value: 'default', label: 'Default' },
    { value: 'longseason', label: 'Long' },
    { value: 'verylongseason', label: 'Very Long' },
  ],
  world_size: [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'default', label: 'Default' },
    { value: 'large', label: 'Large' },
    { value: 'huge', label: 'Huge' },
  ],
  boolean: [
    { value: 'default', label: 'Default' },
    { value: 'always', label: 'Enabled' },
    { value: 'never', label: 'Disabled' },
  ],
  ghostenabled: [
    { value: 'always', label: 'Become a Ghost' },
    { value: 'none', label: 'Change Survivor' },
  ],
  portalresurection: [
    { value: 'none', label: 'Disabled' },
    { value: 'always', label: 'Enabled' },
  ],
  resettime: [
    { value: 'none', label: 'None' },
    { value: 'slow', label: 'Slow' },
    { value: 'default', label: 'Default' },
    { value: 'fast', label: 'Fast' },
    { value: 'always', label: 'Very Fast' },
  ],
  spawnmode: [
    { value: 'fixed', label: 'Florid Postern' },
    { value: 'scatter', label: 'Random' },
  ],
  day: [
    { value: 'default', label: 'Default' },
    { value: 'longday', label: 'Long Day' },
    { value: 'longdusk', label: 'Long Dusk' },
    { value: 'longnight', label: 'Long Night' },
    { value: 'noday', label: 'No Day' },
    { value: 'nodusk', label: 'No Dusk' },
    { value: 'nonight', label: 'No Night' },
    { value: 'onlynight', label: 'Only Night' },
    { value: 'onlyday', label: 'Only Day' },
    { value: 'onlydusk', label: 'Only Dusk' },
  ],
  season_start: [
    { value: 'default', label: 'Autumn' },
    { value: 'winter', label: 'Winter' },
    { value: 'spring', label: 'Spring' },
    { value: 'summer', label: 'Summer' },
    { value: 'autumnorspring', label: 'Autumn or Spring' },
    { value: 'winterorsummer', label: 'Winter or Summer' },
    { value: 'random', label: 'Random' },
  ],
  events: [
    { value: 'default', label: 'Default' },
    { value: 'always', label: 'Always' },
  ],
};

function getOptionsForKey(key: string): SettingOption[] {
  // Season lengths
  if (['autumn', 'winter', 'spring', 'summer'].includes(key)) return SETTING_LABELS.season;
  
  // Event settings (all shrines and seasonal events)
  const eventKeys = [
    'crowcarnival', 'hallowednights', 'wintersfeast', 
    'perdshrine', 'wargshrine', 'pigshrine', 
    'yotc_carratshrine', 'yotb_beefaloshrine', 'yot_catcoonshrine',
    'yotr_rabbitshrine', 'yotd_dragonshrine', 'yots_wormshrine', 'yoth_knightshrine'
  ];
  if (eventKeys.includes(key)) return SETTING_LABELS.events;
  
  // Boolean settings (enabled/disabled)
  const booleanKeys = [
    'extrastartingitems', 'seasonalstartingitems', 'spawnprotection', 
    'dropeverythingondespawn', 'ghostenabled'
  ];
  if (booleanKeys.includes(key)) return SETTING_LABELS.boolean;
  
  // Penalty/damage settings (none/always for penalty)
  if (key === 'healthpenalty') return SETTING_LABELS.portalresurection; // uses none/always
  if (key === 'lessdamagetaken') return SETTING_LABELS.portalresurection; // uses none/always
  
  // Special settings with unique options
  if (key === 'world_size') return SETTING_LABELS.world_size;
  if (key === 'portalresurection') return SETTING_LABELS.portalresurection;
  if (key === 'resettime') return SETTING_LABELS.resettime;
  if (key === 'spawnmode') return SETTING_LABELS.spawnmode;
  if (key === 'day') return SETTING_LABELS.day;
  if (key === 'season_start') return SETTING_LABELS.season_start;
  if (key === 'events') return SETTING_LABELS.events;
  
  // Default for most settings
  return SETTING_LABELS.default;
}

function getLabelForValue(key: string, value: string): string {
  const options = getOptionsForKey(key);
  const option = options.find(opt => opt.value === value);
  return option?.label || value;
}

function cycleSetting(key: string, currentValue: string, direction: 'prev' | 'next'): string {
  const options = getOptionsForKey(key);
  const currentIndex = options.findIndex(opt => opt.value === currentValue);
  let newIndex = currentIndex;
  
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % options.length;
  } else {
    newIndex = currentIndex - 1;
    if (newIndex < 0) newIndex = options.length - 1;
  }
  
  return options[newIndex].value;
}

// Convert settings names to keys (lowercase, underscores)

interface Props {
  serverId: string;
  isOwner: boolean;
}

export default function WorldSettings({ serverId, isOwner }: Props) {
  const navigate = useNavigate();
  const { shard: urlShard, subtab: urlSubtab } = useParams<{ shard?: string; subtab?: string }>();
  
  // Use URL params or defaults
  const shard = (urlShard === 'caves' ? 'Caves' : 'Master') as 'Master' | 'Caves';
  const tab = (urlSubtab === 'generation' ? 'Generation' : 'Settings') as 'Settings' | 'Generation';
  
  const [overrides, setOverrides] = useState<Record<string, string | boolean | number>>({});
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const setShard = (newShard: 'Master' | 'Caves') => {
    const shardPath = newShard === 'Master' ? 'forest' : 'caves';
    const tabPath = tab.toLowerCase();
    navigate(`/servers/${serverId}/world/${shardPath}/${tabPath}`);
  };
  
  const setTab = (newTab: 'Settings' | 'Generation') => {
    const shardPath = shard === 'Master' ? 'forest' : 'caves';
    const tabPath = newTab.toLowerCase();
    navigate(`/servers/${serverId}/world/${shardPath}/${tabPath}`);
  };

  useEffect(() => {
    const fetchData = async () => {
      const res = await api.get(`/world/${serverId}/${shard}`);
      const data = await res.json();
      setOverrides(data.overrides || {});
      setRawText(data.raw || '');
    };
    fetchData();
  }, [serverId, shard]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const body = rawMode ? { raw: rawText } : { overrides };
    const res = await api.put(`/world/${serverId}/${shard}`, body);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
    } else {
      setSuccess('Saved!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const updateOverride = (key: string, value: string) => {
    setOverrides({ ...overrides, [key]: value });
  };

  // Get the appropriate config based on shard and tab
  const shardName = shard === 'Master' ? 'Forest' : 'Caves';
  const configSection = (settingsConfig as any)[shardName]?.[tab] || {};
  
  
  // Group the settings based on the config - show ALL settings from settings.json
  const groupedSettings = Object.entries(configSection).map(([groupName, settingsGroup]) => {
    // Map ALL settings from the config - SHOW EVERYTHING
    const settings = Object.entries(settingsGroup as Record<string, any>).map(([settingName, settingData], settingIndex) => {
      // Get the data from the setting object
      const { displayName, luaKey, iconKey, options } = settingData as {
        displayName: string;
        luaKey: string;
        iconKey: string;
        options: string[];
      };
      
      // Create a unique key for React by prefixing with shard, tab, group and index
      const uniqueKey = `${shardName.toLowerCase()}_${tab.toLowerCase()}_${groupName.toLowerCase().replace(/ /g, '_')}_${settingIndex}_${luaKey}`;
      
      return {
        luaKey,
        displayName,
        iconKey,
        options,
        uniqueKey
      };
    });
    
    return {
      name: groupName,
      settings
    };
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            <button className={shard === 'Master' ? 'active' : ''} onClick={() => setShard('Master')}>Forest</button>
            <button className={shard === 'Caves' ? 'active' : ''} onClick={() => setShard('Caves')}>Caves</button>
          </div>
          <div className="tab-bar" style={{ marginBottom: 0 }}>
            <button className={tab === 'Settings' ? 'active' : ''} onClick={() => setTab('Settings')}>Settings</button>
            <button className={tab === 'Generation' ? 'active' : ''} onClick={() => setTab('Generation')}>Generation</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setRawMode(!rawMode)} className="icon-btn" title={rawMode ? 'Visual Editor' : 'Raw Paste'}>
            <img src={rawMode ? "/images/button_icons/world.png" : "/images/button_icons/profile.png"} alt={rawMode ? 'Visual Editor' : 'Raw Paste'} />
          </button>
          {isOwner && (
            <button onClick={handleSave} className="icon-btn" title="Save">
              <img src="/images/button_icons/save.png" alt="Save" />
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {rawMode ? (
        <div className="card">
          <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Paste your leveldataoverride.lua content. Only safe key/value pairs will be extracted.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={20}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
            disabled={!isOwner}
          />
        </div>
      ) : (
        <div className="world-settings-groups">
          {groupedSettings.map((group) => (
            <div key={group.name} className="settings-group">
              <h3 className="group-title">{group.name}</h3>
              <div className="world-settings-grid">
                {group.settings.map(({luaKey, displayName, iconKey, options, uniqueKey}) => {
                  // Use iconKey from settings.json, fallback to mappings
                  const iconName = iconKey || WORLDSETTINGS_ICONS[luaKey] || WORLDGEN_ICONS[luaKey] || luaKey;
                  const currentValue = (overrides[luaKey] as string) || 'default';
                  
                  return (
                    <div key={uniqueKey} className="world-setting-item">
                      <div className="setting-image">
                        {iconName ? (
                          <img 
                            src={`/images/world_settings/${iconName}.png`} 
                            alt={displayName}
                            onError={(e) => {
                              // Fallback if icon not found
                              console.warn(`Missing icon for ${luaKey}: ${iconName}.png`);
                              (e.target as HTMLImageElement).style.opacity = '0.3';
                            }}
                          />
                        ) : (
                          <div style={{ width: '140px', height: '140px', background: 'rgba(255,255,255,0.05)' }} />
                        )}
                      </div>
                      <div className="setting-label">{displayName}</div>
                      <div className="setting-controls">
                        {isOwner && (
                          <button
                            className="arrow-btn left"
                            onClick={() => updateOverride(luaKey, cycleSetting(luaKey, currentValue, 'prev', options))}
                            aria-label="Previous option"
                          >
                            ◀
                          </button>
                        )}
                        <span className="setting-value">{getLabelForValue(luaKey, currentValue, options)}</span>
                        {isOwner && (
                          <button
                            className="arrow-btn right"
                            onClick={() => updateOverride(luaKey, cycleSetting(luaKey, currentValue, 'next', options))}
                            aria-label="Next option"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}