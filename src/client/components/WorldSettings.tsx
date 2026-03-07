import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useWorldSettingsStore } from '../stores/WorldSettingsStore';
import { toast } from '../utils/toast';
import Tabs from './Tabs';
import WorldSettingsContent from './WorldSettingsContent';

interface Props {
  serverId: string;
  isOwner: boolean;
  onSaveRef?: React.MutableRefObject<(() => void) | undefined>;
}

export default function WorldSettings({ serverId, isOwner, onSaveRef }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loadFromMappings, getAllMappings } = useWorldSettingsStore();
  
  // Parse URL to get current state
  const pathParts = location.pathname.split('/');
  const worldIndex = pathParts.indexOf('world');
  const currentShardPath = worldIndex >= 0 ? pathParts[worldIndex + 1] : 'forest';
  const currentSubtab = worldIndex >= 0 ? pathParts[worldIndex + 2] : 'settings';
  
  const [shard, setShard] = useState<'Master' | 'Caves'>(currentShardPath === 'caves' ? 'Caves' : 'Master');
  const [tab, setTab] = useState<'Settings' | 'Generation'>(currentSubtab === 'generation' ? 'Generation' : 'Settings');
  
  // Track last tab for each shard - only initialize the current shard from URL
  const initialShard = currentShardPath === 'caves' ? 'Caves' : 'Forest';
  const lastTabRef = useRef<{ Forest: string; Caves: string }>({
    Forest: initialShard === 'Forest' ? currentSubtab : 'settings',
    Caves: initialShard === 'Caves' ? currentSubtab : 'settings'
  });
  
  const updateURL = (newShard: 'Master' | 'Caves', newTab: 'Settings' | 'Generation') => {
    const shardPath = newShard === 'Master' ? 'forest' : 'caves';
    const tabPath = newTab.toLowerCase();
    navigate(`/servers/${serverId}/world/${shardPath}/${tabPath}`);
  };

  const handleShardChange = (tabName: string) => {
    const newShard = tabName === 'Forest' ? 'Master' : 'Caves';
    const shardName = tabName as 'Forest' | 'Caves';
    
    // Get the last tab for this shard, default to settings
    const lastTab = lastTabRef.current[shardName] || 'settings';
    const newTab = lastTab === 'generation' ? 'Generation' : 'Settings';
    
    setShard(newShard);
    setTab(newTab);
    updateURL(newShard, newTab);
  };
  
  const handleTabChange = (tabName: string) => {
    const newTab = tabName as 'Settings' | 'Generation';
    const currentShardName = shard === 'Master' ? 'Forest' : 'Caves';
    
    // Remember this tab for this shard
    lastTabRef.current[currentShardName] = newTab.toLowerCase();
    
    setTab(newTab);
    updateURL(shard, newTab);
  };

  const handleSave = async () => {
    const body = { overrides: getAllMappings() };
    const res = await api.put(`/world/${serverId}/${shard}`, body);
    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error || 'Failed to save world settings');
    } else {
      toast.success('World settings saved');
    }
  };

  // Update state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const worldIndex = pathParts.indexOf('world');
    const shardPath = worldIndex >= 0 ? pathParts[worldIndex + 1] : 'forest';
    const subtab = worldIndex >= 0 ? pathParts[worldIndex + 2] : 'settings';
    
    setShard(shardPath === 'caves' ? 'Caves' : 'Master');
    setTab(subtab === 'generation' ? 'Generation' : 'Settings');
  }, [location.pathname]);

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

  return (
    <>
      <Tabs
        tabs={['Forest', 'Caves']}
        defaultActiveTab={shard === 'Master' ? 0 : 1}
        onTabChange={handleShardChange}
      >
        <Tabs
          tabs={['Settings', 'Generation']}
          defaultActiveTab={tab === 'Settings' ? 0 : 1}
          onTabChange={handleTabChange}
        >
          <WorldSettingsContent 
            shard={shard} 
            tab={tab} 
            isOwner={isOwner} 
          />
        </Tabs>
      </Tabs>
    </>
  );
}