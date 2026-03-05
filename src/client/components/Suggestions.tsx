import { useState, useEffect } from 'react';
import { api } from '@client/api';
import { useAuth } from '@client/stores/Auth';
import ModSearch from '@client/components/Mods/ModSearch';

interface ModDetails {
  title: string;
  previewUrl: string;
}

interface Suggestion {
  id: number;
  server_id: number;
  user_id: number;
  workshop_id: string;
  suggested_config: string;
  status: 'pending' | 'approved' | 'denied';
  suggested_by: string;
  created_at: string;
}

interface Props {
  serverId: string;
  isOwner: boolean;
}

export default function Suggestions({ serverId, isOwner }: Props) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [modDetails, setModDetails] = useState<Record<string, ModDetails>>({});
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSuggestions = async () => {
    const res = await api.get(`/suggestions/${serverId}`);
    const data = await res.json();
    const list: Suggestion[] = Array.isArray(data) ? data : [];
    setSuggestions(list);
    fetchModDetails(list);
  };

  const fetchModDetails = async (list: Suggestion[]) => {
    const workshopIds = [...new Set(list.map((s) => s.workshop_id))];
    const missing = workshopIds.filter((id) => !modDetails[id]);
    if (missing.length === 0) return;

    const results = await Promise.all(
      missing.map(async (workshopId) => {
        try {
          const res = await api.get(`/mods/details/${workshopId}`);
          const details = await res.json();
          return { workshopId, details };
        } catch {
          return null;
        }
      })
    );

    const newDetails: Record<string, ModDetails> = {};
    for (const r of results) {
      if (r) newDetails[r.workshopId] = r.details;
    }

    if (Object.keys(newDetails).length > 0) {
      setModDetails((prev) => ({ ...prev, ...newDetails }));
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [serverId]);

  const handleSuggestMod = async (workshopId: string) => {
    setError('');
    const res = await api.post(`/suggestions/${serverId}`, {
      workshopId,
      suggestedConfig: {},
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    setSuccess('Mod suggested!');
    setTimeout(() => setSuccess(''), 3000);
    fetchSuggestions();
  };

  const handleAction = async (id: number, action: 'approve' | 'deny') => {
    setError('');
    const res = await api.put(`/suggestions/${id}/${action}`);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    if (action === 'approve') {
      setSuccess('Mod approved and installed!');
    } else {
      setSuccess('Suggestion denied.');
    }
    setTimeout(() => setSuccess(''), 3000);
    fetchSuggestions();
  };

  const canSuggest = !isOwner;

  const statusClass = (status: string) => {
    if (status === 'approved') return 'running';
    if (status === 'denied') return 'stopped';
    return 'starting';
  };

  return (
    <>
      <div className="card">
        <div className="suggestions-header">
          <h3>Mod Suggestions ({suggestions.length})</h3>
          {canSuggest && (
            <button onClick={() => setShowSearchModal(true)} className="btn btn-primary">
              Suggest a Mod
              <img src="/images/button_icons/workshop_filter.png" alt="" />
            </button>
          )}
        </div>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        {suggestions.length === 0 ? (
          <p className="empty-state">No suggestions yet.</p>
        ) : (
          suggestions.map((s) => {
            const info = modDetails[s.workshop_id];
            return (
              <div key={s.id} className="suggestion-item">
                {info?.previewUrl ? (
                  <img src={info.previewUrl} alt="" className="suggestion-thumbnail" />
                ) : (
                  <div className="suggestion-thumbnail-placeholder" />
                )}
                <div className="suggestion-info">
                  <div className="suggestion-title">
                    {info?.title || `Workshop-${s.workshop_id}`}
                  </div>
                  <div className="suggestion-meta">
                    by {s.suggested_by} &middot; {new Date(s.created_at).toLocaleDateString()}
                  </div>
                  <span className={`status-badge ${statusClass(s.status)}`}>
                    {s.status}
                  </span>
                </div>
                {isOwner && s.status === 'pending' && (
                  <div className="suggestion-actions">
                    <button
                      onClick={() => handleAction(s.id, 'approve')}
                      className="icon-btn"
                      title="Approve"
                    >
                      <img src="/images/button_icons/enabled_filter.png" alt="Approve" />
                    </button>
                    <button
                      onClick={() => handleAction(s.id, 'deny')}
                      className="icon-btn"
                      title="Deny"
                    >
                      <img src="/images/button_icons/delete.png" alt="Deny" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ModSearch
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        installedMods={{}}
        modInfoCache={{}}
        onAddMod={handleSuggestMod}
        isOwner={true}
        addButtonLabel="Suggest"
      />
    </>
  );
}
