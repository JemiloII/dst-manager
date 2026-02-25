import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../stores/auth';

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
  const [workshopId, setWorkshopId] = useState('');
  const [config, setConfig] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSuggestions = async () => {
      const res = await api.get(`/suggestions/${serverId}`);
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    };
    fetchSuggestions();
  }, [serverId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let parsedConfig = {};
    if (config.trim()) {
      try {
        parsedConfig = JSON.parse(config);
      } catch {
        setError('Invalid JSON config');
        return;
      }
    }

    const res = await api.post(`/suggestions/${serverId}`, {
      workshopId,
      suggestedConfig: parsedConfig,
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    setWorkshopId('');
    setConfig('');

    const updated = await api.get(`/suggestions/${serverId}`);
    setSuggestions(await updated.json());
  };

  const handleAction = async (id: number, action: 'approve' | 'deny') => {
    await api.put(`/suggestions/${id}/${action}`);
    const updated = await api.get(`/suggestions/${serverId}`);
    setSuggestions(await updated.json());
  };

  return (
    <>
      {user?.role === 'guest' && (
        <div className="card">
          <h3 style={{ color: '#fff', margin: '0 0 0.75rem' }}>Suggest a Mod</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Workshop ID</label>
              <input
                value={workshopId}
                onChange={(e) => setWorkshopId(e.target.value)}
                placeholder="e.g. 378160973"
                required
              />
            </div>
            <div className="form-group">
              <label>Config (optional JSON)</label>
              <textarea
                value={config}
                onChange={(e) => setConfig(e.target.value)}
                rows={3}
                placeholder='{"option": "value"}'
              />
            </div>
            {error && <p className="error-message">{error}</p>}
            <button type="submit">Submit Suggestion</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 style={{ color: '#fff', margin: '0 0 0.75rem' }}>Mod Suggestions</h3>
        {suggestions.length === 0 ? (
          <p style={{ color: '#aaa' }}>No suggestions yet.</p>
        ) : (
          suggestions.map((s) => (
            <div key={s.id} className="suggestion-card">
              <div className="suggestion-info">
                <strong style={{ color: '#fff' }}>workshop-{s.workshop_id}</strong>
                <br />
                <small style={{ color: '#aaa' }}>
                  By {s.suggested_by} &middot; {new Date(s.created_at).toLocaleDateString()}
                </small>
                <br />
                <span className={`status-badge ${s.status === 'approved' ? 'running' : s.status === 'denied' ? 'stopped' : 'starting'}`}>
                  {s.status}
                </span>
              </div>
              {isOwner && s.status === 'pending' && (
                <div className="suggestion-actions">
                  <button onClick={() => handleAction(s.id, 'approve')} style={{ background: '#28a745', fontSize: '0.85rem' }}>
                    Approve
                  </button>
                  <button onClick={() => handleAction(s.id, 'deny')} style={{ background: '#dc3545', fontSize: '0.85rem' }}>
                    Deny
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
