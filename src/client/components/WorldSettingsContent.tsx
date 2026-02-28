import Settings from '../data/Settings.json';
import { useWorldSettingsStore } from '../stores/WorldSettingsStore';
import CycleSelector from './CycleSelector';

interface Props {
  shard: 'Master' | 'Caves';
  tab: 'Settings' | 'Generation';
  isOwner: boolean;
}

export default function WorldSettingsContent({ shard, tab, isOwner }: Props) {
  const { selections, setSelection } = useWorldSettingsStore();
  
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
                    {icon ? 
                      <img src={`/images/world_settings/${icon}`} alt={label} /> :
                      <div className="setting-image-placeholder" />
                    }
                  </div>
                  <CycleSelector
                    label={label}
                    value={currentOption}
                    options={options}
                    onChange={(value) => setSelection(override, value as string)}
                    className="world-setting-selector"
                    disabled={!isOwner}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}