import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Settings from '../data/Settings.json';
import { useWorldSettingsStore } from '../stores/WorldSettingsStore';

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
  
  const { selections, cycleSelection, loadFromMappings, getAllMappings } = useWorldSettingsStore();
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
      loadFromMappings(data.overrides || {});
      setRawText(data.raw || '');
    };
    fetchData();
  }, [serverId, shard, loadFromMappings]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const body = rawMode ? { raw: rawText } : { overrides: getAllMappings() };
    const res = await api.put(`/world/${serverId}/${shard}`, body);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
    } else {
      setSuccess('Saved!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // Get the appropriate config based on shard and tab
  const shardName = shard === 'Master' ? 'Forest' : 'Caves';
  const configSection = (Settings as any)[shardName]?.[tab] || {};
  
  // Group the settings based on the config
  const groupedSettings = Object.entries(configSection).map(([groupName, settingsGroup]) => {
    const settings = (settingsGroup as any[]).map((settingData, settingIndex) => {
      const { label, override, icon, options } = settingData;
      
      // Create a unique key for React
      const uniqueKey = `${shardName.toLowerCase()}_${tab.toLowerCase()}_${groupName.toLowerCase().replace(/ /g, '_')}_${settingIndex}_${override}`;
      
      return {
        label,
        override,
        icon,
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
                {group.settings.map((settingData) => {
                  const { label, override, icon, options, uniqueKey } = settingData;
                  const currentOption = selections[override] || options.find((o: string) => o === 'Default') || options[0];
                  
                  return (
                    <div key={uniqueKey} className="world-setting-item">
                      <div className="setting-image">
                        {icon ? (
                          <img 
                            src={`/images/world_settings/${icon}`} 
                            alt={label}
                            onError={(e) => {
                              console.warn(`Missing icon for ${override}: ${icon}`);
                              (e.target as HTMLImageElement).style.opacity = '0.3';
                            }}
                          />
                        ) : (
                          <div style={{ width: '140px', height: '140px', background: 'rgba(255,255,255,0.05)' }} />
                        )}
                      </div>
                      <div className="setting-label">{label}</div>
                      <div className="setting-controls">
                        {isOwner && (
                          <button
                            className="arrow-btn left"
                            onClick={() => cycleSelection(override, 'prev')}
                            aria-label="Previous option"
                          >
                            ◀
                          </button>
                        )}
                        <span className="setting-value">{currentOption}</span>
                        {isOwner && (
                          <button
                            className="arrow-btn right"
                            onClick={() => cycleSelection(override, 'next')}
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