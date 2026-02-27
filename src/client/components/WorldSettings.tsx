import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Settings from '../data/Settings.json';
import { useWorldSettingsStore } from '../stores/WorldSettingsStore';
import Tabs from './Tabs';

interface Props {
  serverId: string;
  isOwner: boolean;
}

export default function WorldSettings({ serverId, isOwner, onSaveRef }: Props & { onSaveRef?: React.MutableRefObject<(() => void) | undefined> }) {
  const navigate = useNavigate();
  const { shard: urlShard, subtab: urlSubtab } = useParams<{ shard?: string; subtab?: string }>();
  
  // Use URL params or defaults
  const shard = (urlShard === 'caves' ? 'Caves' : 'Master') as 'Master' | 'Caves';
  const tab = (urlSubtab === 'generation' ? 'Generation' : 'Settings') as 'Settings' | 'Generation';
  
  const { selections, cycleSelection, loadFromMappings, getAllMappings } = useWorldSettingsStore();
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

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const body = { overrides: getAllMappings() };
    const res = await api.put(`/world/${serverId}/${shard}`, body);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
    } else {
      setSuccess('Saved!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const res = await api.get(`/world/${serverId}/${shard}`);
      const data = await res.json();
      loadFromMappings(data.overrides || {});
    };
    fetchData();
  }, [serverId, shard, loadFromMappings]);

  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSave;
    }
  });

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
      <div className="world-settings-header">
        <div className="world-settings-tabs">
          <Tabs
            tabs={['Forest', 'Caves']}
            defaultActiveTab={shard === 'Master' ? 0 : 1}
            onTabChange={(tabName) => setShard(tabName === 'Forest' ? 'Master' : 'Caves')}
          />
          <Tabs
            tabs={['Settings', 'Generation']}
            defaultActiveTab={tab === 'Settings' ? 0 : 1}
            onTabChange={(tabName) => setTab(tabName as 'Settings' | 'Generation')}
          />
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

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
    </>
  );
}