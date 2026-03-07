import { useState, useEffect } from 'react';
import './ModManager.scss';
import { api } from '../../api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../ConfirmModal';
import ModListItem from './ModListItem';
import ModSearch from './ModSearch';
import ModConfig from './ModConfig';
import ModCopy from './ModCopy';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ key: string; title: string } | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [hasConfigMap, setHasConfigMap] = useState<Record<string, boolean>>({});
  const [configureModal, setConfigureModal] = useState<{
    key: string; 
    title: string; 
    options: Record<string, unknown>;
    currentValues: Record<string, unknown>;
  } | null>(null);

  const fetchHasConfig = async (workshopIds: string[]) => {
    if (workshopIds.length === 0) return;
    try {
      const res = await api.post('/mods/has-config', { workshopIds });
      const data = await res.json();
      setHasConfigMap(prev => ({ ...prev, ...data }));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const fetchMods = async () => {
      const res = await api.get(`/mods/server/${serverId}`);
      const data = await res.json();
      setMods(data);

      const modKeys = Object.keys(data);
      const workshopIds = modKeys.map(key => key.replace('workshop-', ''));

      // Fetch details and has-config in parallel
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

      const [results] = await Promise.all([
        Promise.all(detailPromises),
        fetchHasConfig(workshopIds),
      ]);

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
        toast.error(data.error);
      } else {
        toast.success('Mods saved!');
      }
    } catch {
      toast.error('Failed to save mods');
    }
  };

  const addMod = async (workshopId: string, info?: ModInfo) => {
    const key = `workshop-${workshopId}`;
    if (key in mods) {
      toast.error('Mod already installed');
      return;
    }

    if (info && !modInfoCache[workshopId]) {
      setModInfoCache(prev => ({ ...prev, [workshopId]: info }));
    }

    const newMod: ModConfigType = {
      enabled: true,
      configuration_options: {}
    };

    const updatedMods = { ...mods, [key]: newMod };
    setMods(updatedMods);

    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      toast.error('Failed to add mod');
      setMods(mods);
    } else {
      toast.success('Mod added!');
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

    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      toast.error('Failed to toggle mod');
      setMods(mods);
    }
  };

  const removeMod = async (key: string) => {
    const updatedMods = { ...mods };
    delete updatedMods[key];
    setMods(updatedMods);

    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      toast.error('Failed to remove mod');
      setMods(mods);
    } else {
      toast.success('Mod removed!');
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
        setModInfoCache(prev => ({
          ...prev,
          [workshopId]: {
            ...prev[workshopId],
            version: configData.version,
            configuration_options: configData.configuration_options
          }
        }));

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
        toast.info('No configuration options available for this mod');
      }
    } catch {
      toast.error('Failed to load mod configuration');
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

    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error);
      setMods(mods);
    } else {
      toast.success('Mod configuration saved!');
    }
  };

  const handleCopyMods = async (copiedMods: Record<string, ModConfigType>) => {
    const merged = { ...mods, ...copiedMods };
    setMods(merged);

    const res = await api.put(`/mods/server/${serverId}`, merged);
    if (!res.ok) {
      toast.error('Failed to copy mods');
      setMods(mods);
    } else {
      const newKeys = Object.keys(copiedMods).filter((k) => !(k in mods));
      const promises = newKeys.map(async (key) => {
        const workshopId = key.replace('workshop-', '');
        if (modInfoCache[workshopId]) return null;
        try {
          const r = await api.get(`/mods/details/${workshopId}`);
          return { workshopId, details: await r.json() };
        } catch { return null; }
      });
      const results = await Promise.all(promises);
      const newCache: Record<string, ModInfo> = {};
      for (const r of results) {
        if (r) newCache[r.workshopId] = r.details;
      }
      if (Object.keys(newCache).length > 0) {
        setModInfoCache((prev) => ({ ...prev, ...newCache }));
      }
      toast.success('Mods copied!');
    }
  };

  const filteredMods = Object.entries(mods).filter(([key]) => {
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
            <div className="mod-header-actions">
              <button onClick={() => setShowCopyModal(true)} className="btn btn-secondary">
                Copy From Server
              </button>
              <button onClick={() => setShowSearchModal(true)} className="btn btn-primary">
                Search Workshop
                <img src="/images/button_icons/workshop_filter.png" alt="" />
              </button>
            </div>
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
                hasConfig={hasConfigMap[workshopId]}
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
          modTitle={configureModal.title}
          options={configureModal.options}
          currentValues={configureModal.currentValues}
          onSave={handleConfigSave}
          onClose={() => setConfigureModal(null)}
          isOwner={isOwner}
        />
      )}
      
      {/* Copy From Server Modal */}
      <ModCopy
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        currentServerId={serverId}
        onCopy={handleCopyMods}
      />

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