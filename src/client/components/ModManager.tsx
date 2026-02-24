import { useState, useEffect } from 'react';
import { api } from '../api';

interface ModConfig {
  enabled: boolean;
  configuration_options: Record<string, unknown>;
}

interface SearchResult {
  workshopId: string;
  title: string;
  description: string;
  previewUrl: string;
}

interface Props {
  serverId: number;
  isOwner: boolean;
}

export default function ModManager({ serverId, isOwner }: Props) {
  const [mods, setMods] = useState<Record<string, ModConfig>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchMods = async () => {
      const res = await api.get(`/mods/server/${serverId}`);
      const data = await res.json();
      setMods(data);
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
            <img src="/button_icons/workshop_filter.png" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: '0.5rem' }} />
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
            <img src="/button_icons/mods.png" alt="" style={{ width: 24, height: 24, verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Installed Mods ({Object.keys(mods).length})
          </h3>
          {isOwner && <button onClick={handleSave}>Save</button>}
        </div>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        {Object.keys(mods).length === 0 ? (
          <p style={{ color: '#aaa' }}>No mods installed.</p>
        ) : (
          Object.entries(mods).map(([key, mod]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ color: mod.enabled ? '#28a745' : '#dc3545', marginRight: '0.5rem' }}>
                  {mod.enabled ? '●' : '○'}
                </span>
                <span style={{ color: '#fff' }}>{key}</span>
                {Object.keys(mod.configuration_options).length > 0 && (
                  <small style={{ color: '#aaa', marginLeft: '0.5rem' }}>
                    ({Object.keys(mod.configuration_options).length} options)
                  </small>
                )}
              </div>
              {isOwner && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => toggleMod(key)} style={{ fontSize: '0.8rem' }}>
                    {mod.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => removeMod(key)} style={{ fontSize: '0.8rem', background: '#dc3545' }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
