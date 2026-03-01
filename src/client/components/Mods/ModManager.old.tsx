import { useState, useEffect } from 'react';
import './ModManager.scss';
import { api } from '../../api';
import ConfirmModal from '../ConfirmModal';
import ModListItem from './ModListItem';
import ModSearch from './ModSearch';
import ModConfig from './ModConfig';
import { ModConfig as ModConfigType, ModInfo, SearchResult } from './types';

interface Props {
  serverId: string;
  isOwner: boolean;
  onSaveRef?: React.MutableRefObject<(() => void) | undefined>;
}


export default function ModManager({ serverId, isOwner, onSaveRef }: Props) {
  const [mods, setMods] = useState<Record<string, ModConfigType>>({});
  const [modInfoCache, setModInfoCache] = useState<Record<string, ModInfo>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [installedModFilter, setInstalledModFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ key: string; title: string } | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [configureModal, setConfigureModal] = useState<{ key: string; title: string; options: Record<string, unknown> } | null>(null);
  const [modConfigValues, setModConfigValues] = useState<Record<string, unknown>>({});

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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/mods/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      const results = Array.isArray(data) ? data : [];
      setSearchResults(results);
      
      // Fetch details for search results in parallel
      const detailPromises = results
        .filter(result => !modInfoCache[result.workshopId])
        .map(async (result) => {
          try {
            const detailRes = await api.get(`/mods/details/${result.workshopId}`);
            const details = await detailRes.json();
            return { workshopId: result.workshopId, details };
          } catch {
            return null;
          }
        });
      
      const detailResults = await Promise.all(detailPromises);
      const newCache: Record<string, ModInfo> = {};
      detailResults.forEach(result => {
        if (result) {
          newCache[result.workshopId] = result.details;
        }
      });
      
      if (Object.keys(newCache).length > 0) {
        setModInfoCache(prev => ({ ...prev, ...newCache }));
      }
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const addMod = async (workshopId: string) => {
    const key = `workshop-${workshopId}`;
    if (mods[key]) return;
    
    const newMods = { ...mods, [key]: { enabled: true, configuration_options: {} } };
    setMods(newMods);
    
    // Auto-save after adding
    const res = await api.put(`/mods/server/${serverId}`, newMods);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      // Revert on error
      setMods(mods);
    } else {
      setSuccess('Mod added!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const removeMod = async (key: string) => {
    const updated = { ...mods };
    delete updated[key];
    setMods(updated);
    
    // Auto-save after removing
    const res = await api.put(`/mods/server/${serverId}`, updated);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      // Revert on error
      setMods(mods);
    } else {
      setSuccess('Mod removed!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const toggleMod = async (key: string) => {
    const updatedMods = {
      ...mods,
      [key]: { ...mods[key], enabled: !mods[key].enabled },
    };
    setMods(updatedMods);
    
    // Auto-save after toggling
    const res = await api.put(`/mods/server/${serverId}`, updatedMods);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      // Revert on error
      setMods(mods);
    } else {
      setSuccess(mods[key].enabled ? 'Mod disabled!' : 'Mod enabled!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const res = await api.put(`/mods/server/${serverId}`, mods);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
    } else {
      setSuccess('Mods saved!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

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
          Object.entries(mods)
            .filter(([key, mod]) => {
              if (!installedModFilter) return true;
              const workshopId = key.replace('workshop-', '');
              const info = modInfoCache[workshopId];
              const searchLower = installedModFilter.toLowerCase();
              return (
                key.toLowerCase().includes(searchLower) ||
                (info?.title && info.title.toLowerCase().includes(searchLower)) ||
                (info?.description && info.description.toLowerCase().includes(searchLower))
              );
            })
            .map(([key, mod]) => {
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
                  onConfigure={async () => {
                    // Fetch mod config options from modinfo.lua
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
                        
                        setModConfigValues(currentConfig);
                        setConfigureModal({ 
                          key, 
                          title: info?.title || key,
                          options: configData.configuration_options 
                        });
                      } else {
                        setError('No configuration options available for this mod');
                      }
                    } catch {
                      setError('Failed to load mod configuration');
                    }
                  }}
                  onRemove={() => setDeleteConfirm({ key, title: info?.title || key })}
                  isOwner={isOwner}
                />
              );
            })
        )}
      </div>

      {/* Search Modal */}
      <Modal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        title="Browse Steam Workshop"
      >
        <div className="modal-body">
          <div className="search-bar">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search mods..."
              className="search-input"
            />
            <button onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => {
                const info = modInfoCache[result.workshopId] || result;
                const isInstalled = `workshop-${result.workshopId}` in mods;
                
                return (
                  <ModListItem
                    key={result.workshopId}
                    workshopId={result.workshopId}
                    title={info.title}
                    description={info.description}
                    previewUrl={info.previewUrl}
                    isInstalled={isInstalled}
                    onAdd={() => {
                      addMod(result.workshopId);
                      setShowSearchModal(false);
                    }}
                    isOwner={isOwner}
                  />
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Configuration Modal */}
      <Modal
        isOpen={configureModal !== null}
        onClose={() => setConfigureModal(null)}
        title={`Configure ${configureModal?.title}`}
        footerJSX={
          <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button 
              className="icon-btn" 
              onClick={() => {
                // Reset to defaults
                if (configureModal) {
                  const defaultValues: Record<string, any> = {};
                  Object.entries(configureModal.options).forEach(([key, value]) => {
                    const option = value as any;
                    defaultValues[key] = option.default !== undefined ? option.default : null;
                  });
                  setModConfigValues(defaultValues);
                }
              }}
              title="Reset to Defaults"
            >
              <img src="/images/button_icons/undo.png" alt="Reset" />
            </button>
            <button 
              className="icon-btn" 
              onClick={() => setConfigureModal(null)}
              title="Cancel"
            >
              <img src="/images/button_icons/pinslot_unpin_button.png" alt="Cancel" />
            </button>
            <button 
              className="icon-btn"
              onClick={async () => {
                // Save mod config
                if (configureModal) {
                  const modKey = configureModal.key;
                  const updatedMods = {
                    ...mods,
                    [modKey]: {
                      ...mods[modKey],
                      configuration_options: modConfigValues
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
                    setConfigureModal(null);
                    setSuccess('Mod configuration saved!');
                    setTimeout(() => setSuccess(''), 2000);
                  }
                }
              }}
              title="Save Configuration"
            >
              <img src="/images/button_icons/save.png" alt="Save" />
            </button>
          </div>
        }
      >
        <div className="mod-config-grid">
          {configureModal && Object.entries(configureModal.options).length === 0 ? (
            <p className="empty-state">No configuration options available</p>
          ) : (
            configureModal && Object.entries(configureModal.options).map(([key, value]) => {
              const option = value as any;
              const currentValue = modConfigValues[key];
              
              // Only show options that have an options array (selectable values)
              if (!option.options || !Array.isArray(option.options)) {
                return null;
              }
              
              // Format options for CycleSelector
              const formattedOptions = option.options.map((opt: any) => ({
                value: opt.data,
                label: opt.description
              }));
              
              return (
                <div key={key} className="config-option">
                  <div className="config-info">
                    <label>{option.label || key}</label>
                    {/* Show the option's description if it exists */}
                    {option.description && (
                      <p className="config-description">{option.description}</p>
                    )}
                  </div>
                  <CycleSelector
                    label=""
                    value={currentValue}
                    options={formattedOptions.map((opt: any) => opt.value)}
                    optionLabels={formattedOptions.reduce((acc: any, opt: any) => {
                      acc[opt.value] = opt.label;
                      return acc;
                    }, {})}
                    onChange={(newValue) => {
                      setModConfigValues(prev => ({
                        ...prev,
                        [key]: newValue
                      }));
                    }}
                    disabled={!isOwner}
                  />
                </div>
              );
            })
          )}
        </div>
      </Modal>
      
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