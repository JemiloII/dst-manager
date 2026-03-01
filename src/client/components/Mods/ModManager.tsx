import { useState, useEffect } from 'react';
import './ModManager.scss';
import { api } from '../../api';
import ConfirmModal from '../ConfirmModal';
import ModListItem from './ModListItem';
import ModSearch from './ModSearch';
import ModConfig from './ModConfig';
import { ModConfig as ModConfigType, ModInfo } from './types';

interface Props {
  serverId: string;
  isOwner: boolean;
  onSaveRef?: React.MutableRefObject<(() => void) | undefined>;
}

export default function ModManager({ serverId, isOwner, onSaveRef }: Props) {
  const [mods, setMods] = useState<Record<string, ModConfigType>>({});
  const [modInfoCache, setModInfoCache] = useState<Record<string, ModInfo>>({});
  const [installedModFilter, setInstalledModFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ key: string; title: string } | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [configureModal, setConfigureModal] = useState<{ 
    key: string; 
    title: string; 
    options: Record<string, unknown>;
    currentValues: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    const fetchMods = async () => {
      const res = await api.get(`/mods/server/${serverId}`);
      const data = await res.json();
      setMods(data);
      
      // Fetch mod details for all installed mods in parallel
      const modKeys = Object.keys(data);
      const workshopIds = modKeys.map(key => key.replace('workshop-', ''));
      
      const detailPromises = workshopIds
        .filter(workshopId => !modInfoCache[workshopId])
        .map(async (workshopId) => {
          try {
            const detailRes = await api.get(`/mods/details/${workshopId}`);
            const details = await detailRes.json();
            return { workshopId, details };
          } catch {
            return null;
          }
        });
      
      const results = await Promise.all(detailPromises);
      const newCache: Record<string, ModInfo> = {};
      results.forEach(result => {
        if (result) {
          newCache[result.workshopId] = result.details;
        }
      });
      
      if (Object.keys(newCache).length > 0) {
        setModInfoCache(prev => ({ ...prev, ...newCache }));
      }
    };
    fetchMods();
  }, [serverId]);
  
  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSave;
    }
  });

  const handleSave = async () => {
    try {
      const res = await api.put(`/mods/server/${serverId}`, mods);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
      } else {
        setSuccess('Mods saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Failed to save mods');
    }
  };

  const addMod = async (workshopId: string) => {
    const key = `workshop-${workshopId}`;
    if (key in mods) {
      setError('Mod already installed');
      return;
    }

    const newMod: ModConfigType = {
      enabled: true,
      configuration_options: {}
    };
    
    const updatedMods = { ...mods, [key]: newMod };
    setMods(updatedMods);

    // Auto-save
    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      setError('Failed to add mod');
      setMods(mods); // Revert
    } else {
      setSuccess('Mod added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const toggleMod = async (key: string) => {
    const updatedMods = {
      ...mods,
      [key]: {
        ...mods[key],
        enabled: !mods[key].enabled
      }
    };
    setMods(updatedMods);

    // Auto-save
    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      setError('Failed to toggle mod');
      setMods(mods); // Revert
    }
  };

  const removeMod = async (key: string) => {
    const updatedMods = { ...mods };
    delete updatedMods[key];
    setMods(updatedMods);

    // Auto-save
    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      setError('Failed to remove mod');
      setMods(mods); // Revert
    } else {
      setSuccess('Mod removed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleConfigureClick = async (key: string) => {
    const workshopId = key.replace('workshop-', '');
    const info = modInfoCache[workshopId];
    const mod = mods[key];
    
    try {
      const configRes = await api.get(`/mods/config/${workshopId}`);
      const configData = await configRes.json();
      
      if (configData.configuration_options && Object.keys(configData.configuration_options).length > 0) {
        // Update cache with config options
        setModInfoCache(prev => ({
          ...prev,
          [workshopId]: {
            ...prev[workshopId],
            version: configData.version,
            configuration_options: configData.configuration_options
          }
        }));
        
        // Set current values from saved config or defaults
        const currentConfig: Record<string, unknown> = {};
        for (const [optKey, optDef] of Object.entries(configData.configuration_options)) {
          const def = optDef as any;
          currentConfig[optKey] = mod.configuration_options[optKey] ?? def.default ?? def.options?.[0]?.data;
        }
        
        setConfigureModal({ 
          key, 
          title: info?.title || key,
          options: configData.configuration_options,
          currentValues: currentConfig
        });
      } else {
        setError('No configuration options available for this mod');
      }
    } catch {
      setError('Failed to load mod configuration');
    }
  };

  const handleConfigSave = async (values: Record<string, unknown>) => {
    if (!configureModal) return;
    
    const modKey = configureModal.key;
    const updatedMods = {
      ...mods,
      [modKey]: {
        ...mods[modKey],
        configuration_options: values
      }
    };
    setMods(updatedMods);
    
    // Auto-save to server
    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      // Revert on error
      setMods(mods);
    } else {
      setSuccess('Mod configuration saved!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const filteredMods = Object.entries(mods).filter(([key, mod]) => {
    if (!installedModFilter) return true;
    const workshopId = key.replace('workshop-', '');
    const info = modInfoCache[workshopId];
    const searchLower = installedModFilter.toLowerCase();
    return (
      key.toLowerCase().includes(searchLower) ||
      (info?.title && info.title.toLowerCase().includes(searchLower)) ||
      (info?.description && info.description.toLowerCase().includes(searchLower))
    );
  });

  return (
    <>
      <div className="card">
        <div className="mod-header">
          <h3>
            <img src="/images/button_icons/mods.png" alt="" className="mod-header-icon" />
            Installed Mods ({Object.keys(mods).length})
          </h3>
          {isOwner && (
            <button onClick={() => setShowSearchModal(true)} className="btn btn-primary">
              Search Workshop
              <img src="/images/button_icons/workshop_filter.png" alt="" />
            </button>
          )}
        </div>
        
        {Object.keys(mods).length > 0 && (
          <div className="search-input-wrapper">
            <img src="/images/servericons/search_light.png" alt="" className="search-icon" />
            <input
              type="text"
              placeholder="Filter installed mods..."
              value={installedModFilter}
              onChange={(e) => setInstalledModFilter(e.target.value)}
              className="search-input"
            />
          </div>
        )}

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        {Object.keys(mods).length === 0 ? (
          <p className="empty-state">No mods installed.</p>
        ) : (
          filteredMods.map(([key, mod]) => {
            const workshopId = key.replace('workshop-', '');
            const info = modInfoCache[workshopId];
            
            return (
              <ModListItem
                key={key}
                workshopId={workshopId}
                title={info?.title || key}
                description={info?.description || ''}
                previewUrl={info?.previewUrl || ''}
                configOptions={Object.keys(mod.configuration_options).length}
                isInstalled={true}
                isEnabled={mod.enabled}
                onToggle={() => toggleMod(key)}
                onConfigure={() => handleConfigureClick(key)}
                onRemove={() => setDeleteConfirm({ key, title: info?.title || key })}
                isOwner={isOwner}
              />
            );
          })
        )}
      </div>

      {/* Search Modal */}
      <ModSearch
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        installedMods={mods}
        modInfoCache={modInfoCache}
        onAddMod={addMod}
        isOwner={isOwner}
      />

      {/* Configuration Modal */}
      {configureModal && (
        <ModConfig
          isOpen={configureModal !== null}
          modKey={configureModal.key}
          modTitle={configureModal.title}
          options={configureModal.options}
          currentValues={configureModal.currentValues}
          onSave={handleConfigSave}
          onClose={() => setConfigureModal(null)}
          isOwner={isOwner}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) {
            removeMod(deleteConfirm.key);
            setDeleteConfirm(null);
          }
        }}
        title="Remove Mod?"
        body={`Are you sure you want to remove "${deleteConfirm?.title}"?`}
      />
    </>
  );
}