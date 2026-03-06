import { useState } from 'react';
import { api } from '../../api';
import Modal from '../Modal';
import ModListItem from './ModListItem';
import { ModInfo, SearchResult } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  installedMods: Record<string, any>;
  modInfoCache: Record<string, any>;
  onAddMod: (workshopId: string, info: ModInfo) => void;
  isOwner: boolean;
  addButtonLabel?: string;
}

export default function ModSearch({
  isOpen,
  onClose,
  installedMods,
  modInfoCache,
  onAddMod,
  isOwner,
  addButtonLabel,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/mods/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      const results = Array.isArray(data) ? data : [];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = (result: SearchResult) => {
    const info: ModInfo = { title: result.title, description: result.description, previewUrl: result.previewUrl };
    onAddMod(result.workshopId, info);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
              const isInstalled = `workshop-${result.workshopId}` in installedMods;
              
              return (
                <ModListItem
                  key={result.workshopId}
                  workshopId={result.workshopId}
                  title={info.title}
                  description={info.description}
                  previewUrl={info.previewUrl}
                  isInstalled={isInstalled}
                  onAdd={() => handleAdd(result)}
                  isOwner={isOwner}
                  addButtonLabel={addButtonLabel}
                />
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}