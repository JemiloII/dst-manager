import { useState, useEffect, useRef } from 'react';
import { api } from '@client/api';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

interface ServerAdmin {
  id: number;
  user_id: number | null;
  kuid: string;
  username: string | null;
  display_name: string | null;
  added_at: string;
}

interface PermanentEntry {
  id: null;
  type: 'owner' | 'site_admin';
  label: string;
  kuid: string | null;
  display_name: string;
}

interface SearchResult {
  id: number;
  username: string;
  display_name: string;
}

interface Props {
  shareCode: string;
}

export default function AdminList({ shareCode }: Props) {
  const [admins, setAdmins] = useState<ServerAdmin[]>([]);
  const [permanent, setPermanent] = useState<PermanentEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [kuidInput, setKuidInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [removeTarget, setRemoveTarget] = useState<ServerAdmin | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchAdmins = async () => {
    const res = await api.get(`/servers/${shareCode}/admins`);
    if (res.ok) {
      const data = await res.json();
      setPermanent(data.permanent);
      setAdmins(data.admins);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [shareCode]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const res = await api.get(`/servers/${shareCode}/admins/search-users?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        setSearchResults(await res.json());
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, shareCode]);

  const closeAddModal = () => {
    setShowAddModal(false);
    setSelectedUser(null);
    setKuidInput('');
    setSearchQuery('');
    setSearchResults([]);
    setError('');
  };

  const handleAdd = async () => {
    setError('');
    if (!selectedUser && !kuidInput.trim()) return;

    const body: any = {};
    if (selectedUser) body.userId = selectedUser.id;
    if (kuidInput.trim()) body.kuid = kuidInput.trim();

    const res = await api.post(`/servers/${shareCode}/admins`, body);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }

    setSuccess('Admin added!');
    setTimeout(() => setSuccess(''), 3000);
    closeAddModal();
    fetchAdmins();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setError('');

    const res = await api.delete(`/servers/${shareCode}/admins/${removeTarget.id}`);
    if (!res.ok) {
      setError((await res.json()).error);
    } else {
      setSuccess('Admin removed.');
      setTimeout(() => setSuccess(''), 3000);
    }

    setRemoveTarget(null);
    fetchAdmins();
  };

  const getRemoveLabel = () => {
    if (!removeTarget) return '';
    return removeTarget.display_name || removeTarget.username || removeTarget.kuid;
  };

  const canAdd = selectedUser || kuidInput.trim();

  return (
    <>
      <div className="card">
        <div className="admin-list-header">
          <h3>Server Admins ({permanent.length + admins.length})</h3>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            Add Admin
          </button>
        </div>

        {success && <p className="success-message">{success}</p>}

        {permanent.map((entry, i) => (
          <div key={`perm-${i}`} className="admin-item">
            <div className="admin-info">
              <div className="admin-name">
                {entry.display_name} <span className="admin-label">({entry.label})</span>
              </div>
              {entry.kuid && <div className="admin-kuid">{entry.kuid}</div>}
            </div>
          </div>
        ))}

        {admins.length === 0 && permanent.length > 0 && (
          <p className="admin-empty">No custom admins added yet.</p>
        )}

        {admins.map((admin) => (
          <div key={admin.id} className="admin-item">
            <div className="admin-info">
              <div className="admin-name">
                {admin.user_id ? (admin.display_name || admin.username) : admin.kuid}
                {admin.user_id && <span className="admin-badge">Server Admin</span>}
                {!admin.user_id && <span className="admin-badge admin-badge-ingame">Game Admin</span>}
              </div>
              {admin.user_id && admin.kuid && <div className="admin-kuid">{admin.kuid}</div>}
              {admin.user_id && !admin.kuid && <div className="admin-meta">@{admin.username}</div>}
            </div>
            <div className="admin-actions">
              <button
                className="icon-btn"
                onClick={() => setRemoveTarget(admin)}
                title="Remove"
              >
                <img src="/images/button_icons/delete.png" alt="Remove" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showAddModal} onClose={closeAddModal} title="Add Admin" className="admin-modal-form">
        {error && <p className="error-message">{error}</p>}

        <div className="form-group">
          <label className="label-with-tooltip">
            User
            <div className="tooltip-wrapper">
              <button
                type="button"
                className="tooltip-trigger"
                onMouseEnter={(e) => { const t = e.currentTarget.nextElementSibling; if (t) (t as HTMLElement).style.display = 'block'; }}
                onMouseLeave={(e) => { const t = e.currentTarget.nextElementSibling; if (t) (t as HTMLElement).style.display = 'none'; }}
              >
                ?
              </button>
              <div className="tooltip-content">
                <p>Link a registered user to give them Server Admin access — they can manage this server on the website. Optional if you only need a Game Admin.</p>
              </div>
            </div>
          </label>
          {selectedUser ? (
            <div className="admin-selected-user">
              <span><strong>{selectedUser.display_name || selectedUser.username}</strong></span>
              <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>Change</button>
            </div>
          ) : (
            <div className="admin-search-wrapper">
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="admin-search-results">
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      className="admin-search-item"
                      onClick={() => { setSelectedUser(u); setSearchQuery(''); setSearchResults([]); }}
                    >
                      <span className="admin-search-name">{u.display_name || u.username}</span>
                      <span className="admin-search-username">@{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="label-with-tooltip">
            KUID
            <div className="tooltip-wrapper">
              <button
                type="button"
                className="tooltip-trigger"
                onMouseEnter={(e) => { const t = e.currentTarget.nextElementSibling; if (t) (t as HTMLElement).style.display = 'block'; }}
                onMouseLeave={(e) => { const t = e.currentTarget.nextElementSibling; if (t) (t as HTMLElement).style.display = 'none'; }}
              >
                ?
              </button>
              <div className="tooltip-content">
                <p>A Klei User ID (e.g. KU_abc123) gives in-game admin privileges. Find it on your Klei account page. Can be added with or without a website user.</p>
              </div>
            </div>
          </label>
          <input
            type="text"
            placeholder="KU_abc123"
            value={kuidInput}
            onChange={(e) => setKuidInput(e.target.value)}
          />
        </div>

        <button className="btn btn-primary btn-full" onClick={handleAdd} disabled={!canAdd}>
          Add Admin
        </button>
      </Modal>

      <ConfirmModal
        isOpen={!!removeTarget}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        body={`Remove ${getRemoveLabel()} as server admin?`}
      />
    </>
  );
}
