import { useState, useEffect } from 'react';
import { api } from '../api';

interface ModConfig {
  enabled: boolean;
  configuration_options: Record<string, unknown>;
}

interface ModInfo {
  title: string;
  description: string;
  previewUrl: string;
}

interface SearchResult {
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string;
}

interface Props {
  serverId: string;
  isOwner: boolean;
}

function parseBBCode(text: string): string {
  if (!text) return '';
  
  // Basic BBCode parsing
  return text
    .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
    .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>')
    .replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
    .replace(/\[url\](.*?)\[\/url\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\[list\]/g, '<ul>')
    .replace(/\[\/list\]/g, '</ul>')
    .replace(/\[\*\]/g, '<li>')
    .replace(/\[h1\](.*?)\[\/h1\]/g, '<h3>$1</h3>')
    .replace(/\[h2\](.*?)\[\/h2\]/g, '<h4>$1</h4>')
    .replace(/\[h3\](.*?)\[\/h3\]/g, '<h5>$1</h5>')
    .replace(/\[spoiler\](.*?)\[\/spoiler\]/g, '<details><summary>Spoiler</summary>$1</details>')
    .replace(/\[code\](.*?)\[\/code\]/g, '<code>$1</code>')
    .replace(/\[quote\](.*?)\[\/quote\]/g, '<blockquote>$1</blockquote>')
    .replace(/\[img\](.*?)\[\/img\]/g, '')
    .replace(/\n/g, '<br />');
}

export default function ModManager({ serverId, isOwner }: Props) {
  const [mods, setMods] = useState<Record<string, ModConfig>>({});
  const [modInfoCache, setModInfoCache] = useState<Record<string, ModInfo>>({});
  const [expandedMods, setExpandedMods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [installedModFilter, setInstalledModFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchMods = async () => {
      const res = await api.get(`/mods/server/${serverId}`);
      const data = await res.json();
      setMods(data);
      
      // Fetch mod details for all installed mods
      const modKeys = Object.keys(data);
      const workshopIds = modKeys.map(key => key.replace('workshop-', ''));
      
      for (const workshopId of workshopIds) {
        if (!modInfoCache[workshopId]) {
          try {
            const detailRes = await api.get(`/mods/details/${workshopId}`);
            const details = await detailRes.json();
            setModInfoCache(prev => ({ ...prev, [workshopId]: details }));
          } catch {}
        }
      }
    };
    fetchMods();
  }, [serverId]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/mods/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const addMod = (workshopId: string) => {
    const key = `workshop-${workshopId}`;
    if (mods[key]) return;
    setMods({ ...mods, [key]: { enabled: true, configuration_options: {} } });
  };

  const removeMod = (key: string) => {
    const updated = { ...mods };
    delete updated[key];
    setMods(updated);
  };

  const toggleMod = (key: string) => {
    setMods({
      ...mods,
      [key]: { ...mods[key], enabled: !mods[key].enabled },
    });
  };
  
  const toggleExpanded = (workshopId: string) => {
    const newExpanded = new Set(expandedMods);
    if (newExpanded.has(workshopId)) {
      newExpanded.delete(workshopId);
    } else {
      newExpanded.add(workshopId);
    }
    setExpandedMods(newExpanded);
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
      {isOwner && (
        <div className="card">
          <h3 style={{ color: '#fff', margin: '0 0 0.75rem' }}>
            <img src="/images/button_icons/workshop_filter.png" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Search Steam Workshop
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search mods..."
              style={{ flex: 1 }}
            />
            <button onClick={handleSearch} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {searchResults.map((result) => (
                <div key={result.workshopId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>{result.title}</strong>
                    <br />
                    <small style={{ color: '#aaa' }}>ID: {result.workshopId}</small>
                  </div>
                  <button onClick={() => addMod(result.workshopId)} style={{ fontSize: '0.85rem' }}>Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ color: '#fff', margin: 0 }}>
            <img src="/images/button_icons/mods.png" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Installed Mods ({Object.keys(mods).length})
          </h3>
          {isOwner && (
            <button onClick={handleSave} className="icon-btn" title="Save">
              <img src="/images/button_icons/save.png" alt="Save" />
            </button>
          )}
        </div>
        
        {Object.keys(mods).length > 0 && (
          <div className="search-input-wrapper" style={{ marginBottom: '1rem', position: 'relative' }}>
            <img src="/images/servericons/search.png" alt="" style={{ 
              position: 'absolute', 
              left: '10px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              width: '20px',
              height: '20px',
              pointerEvents: 'none'
            }} />
            <input
              type="text"
              placeholder="Filter installed mods..."
              value={installedModFilter}
              onChange={(e) => setInstalledModFilter(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px' }}
            />
          </div>
        )}

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        {Object.keys(mods).length === 0 ? (
          <p style={{ color: '#aaa' }}>No mods installed.</p>
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
              <div key={key} className="mod-item">
                <div className="mod-content">
                  {info?.previewUrl && (
                    <img src={info.previewUrl} alt="" className="mod-thumbnail" />
                  )}
                  <div className="mod-info">
                    <div className="mod-header">
                      <span className="mod-title">{info?.title || key}</span>
                      {Object.keys(mod.configuration_options).length > 0 && (
                        <small style={{ color: '#aaa', marginLeft: '0.5rem' }}>
                          ({Object.keys(mod.configuration_options).length} options)
                        </small>
                      )}
                    </div>
                    {info?.description && (
                      <>
                        {expandedMods.has(workshopId) ? (
                          <div 
                            className="mod-description expanded" 
                            dangerouslySetInnerHTML={{ __html: parseBBCode(info.description) }}
                          />
                        ) : (
                          <p className="mod-description">{info.description.replace(/\[.*?\]/g, '').slice(0, 100)}...</p>
                        )}
                        <button 
                          className="mod-expand-btn" 
                          onClick={() => toggleExpanded(workshopId)}
                        >
                          {expandedMods.has(workshopId) ? 'Show Less' : 'Read More'}
                        </button>
                      </>
                    )}
                    <a 
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="mod-link"
                    >
                      View on Steam Workshop
                    </a>
                  </div>
                </div>
                {isOwner && (
                  <div className="mod-actions">
                    <button 
                      onClick={() => removeMod(key)} 
                      className="icon-btn mod-delete-btn"
                      title="Remove"
                    >
                      <img src="/images/button_icons/delete.png" alt="Remove" />
                    </button>
                    {Object.keys(mod.configuration_options).length > 0 ? (
                      <button 
                        className="icon-btn"
                        title="Configure"
                      >
                        <img src="/images/button_icons/configure_mod.png" alt="Configure" />
                      </button>
                    ) : (
                      <div className="icon-btn-placeholder"></div>
                    )}
                    <button 
                      onClick={() => toggleMod(key)} 
                      className="icon-btn"
                      title={mod.enabled ? 'Disable' : 'Enable'}
                    >
                      <img 
                        src={mod.enabled ? '/images/button_icons/enabled_filter.png' : '/images/button_icons/disabled_filter.png'} 
                        alt={mod.enabled ? 'Disable' : 'Enable'} 
                      />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
