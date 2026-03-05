import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/Auth';
import Tabs from './Tabs';
import ConfirmModal from './ConfirmModal';

interface Server {
  id: number;
  user_id: number;
  name: string;
  description: string;
  kuid: string;
  share_code: string;
  max_players: number;
  game_mode: string;
  pvp: number;
  password: string;
  status: string;
  is_server_admin?: boolean;
}

interface Props {
  children: (server: Server | null, isOwner: boolean) => ReactNode;
  onSave?: () => Promise<void>;
  onRevert?: () => void;
  saveTitle?: string;
  hasChanges?: boolean;
}

export default function ServerLayout({ children, onSave, onRevert, saveTitle = "Save", hasChanges = false }: Props) {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [server, setServer] = useState<Server | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [players, setPlayers] = useState<{ count: number; max: number; list: string[] }>({ count: 0, max: 0, list: [] });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchServer = async () => {
      const res = await api.get(`/servers/${code}`);
      if (!res.ok) {
        navigate('/');
        return;
      }
      const data = await res.json();
      setServer(data);
    };
    fetchServer();
  }, [code, navigate]);

  // Commented out - events endpoint not implemented yet
  // useEffect(() => {
  //   if (!code) return;
  //   const token = localStorage.getItem('accessToken');
  //   const es = new EventSource(`/api/servers/${code}/events${token ? `?token=${token}` : ''}`);

  //   es.addEventListener('status', (e) => {
  //     const data = JSON.parse(e.data);
  //     setServer((prev) => prev ? { ...prev, status: data.data } : null);
  //   });

  //   es.addEventListener('players', (e) => {
  //     const data = JSON.parse(e.data);
  //     setPlayers(data.data);
  //   });

  //   return () => es.close();
  // }, [code]);

  const handleStart = async () => {
    await api.post(`/servers/${code}/start`);
  };

  const handleStop = async () => {
    await api.post(`/servers/${code}/stop`);
  };

  const handleDelete = async () => {
    await api.delete(`/servers/${code}`);
    navigate('/');
  };

  const handleExport = async () => {
    // Use fetch with Authorization header instead of token in URL
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/servers/${code}/export`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `server-${code}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
  };

  if (!server) return <div>Loading...</div>;

  const isTrueOwner = user?.id === server.user_id || user?.role === 'admin';
  const isOwner = isTrueOwner || !!server.is_server_admin;

  const tabs = ['Config', 'World', 'Mods', 'Logs', 'Suggestions', ...(isTrueOwner ? ['Admins'] : [])];

  // Determine active tab based on current path
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/world')) return 1;
    if (path.includes('/mods')) return 2;
    if (path.includes('/logs')) return 3;
    if (path.includes('/suggestions')) return 4;
    if (path.includes('/admins')) return isTrueOwner ? 5 : 0;
    return 0; // Config
  };

  return (
    <div className="container">
      <div style={{ borderBottom: '1px solid #333', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h1>{server.name}</h1>
            <span style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              backgroundColor: server.status === 'running' ? '#0C8' : '#C33'
            }}>
              {server.status === 'running' ? 'Online' : 'Offline'}
            </span>
            <span style={{ color: '#aaa', marginLeft: '1rem', fontSize: '0.85rem' }}>
              {players.count}/{server.max_players} players
            </span>
          </div>
          {isOwner && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {server.status === 'stopped' ? (
                <button className="icon-btn" onClick={handleStart} title="Start">
                  <img src="/images/button_icons/AFKstart.png" alt="Start" />
                </button>
              ) : (
                <button className="icon-btn" onClick={handleStop} title="Stop">
                  <img src="/images/button_icons/AFKstop.png" alt="Stop" />
                </button>
              )}
              {hasChanges && onRevert && (
                <button className="icon-btn" onClick={onRevert} title="Revert">
                  <img src="/images/button_icons/undo.png" alt="Revert" />
                </button>
              )}
              <button 
                className={`icon-btn ${hasChanges ? 'has-changes' : ''}`}
                onClick={handleSave} 
                title={hasChanges ? "Save Changes" : "Save"}
              >
                <img src="/images/button_icons/save.png" alt="Save" />
              </button>
              <button className="icon-btn download-btn" onClick={handleExport} title="Download">
                <img src="/images/button_icons/update.png" alt="Download" />
              </button>
              {isTrueOwner && (
                <button className="icon-btn" onClick={() => setShowDeleteConfirm(true)} title="Delete">
                  <img src="/images/button_icons/delete.png" alt="Delete" />
                </button>
              )}
            </div>
          )}
        </div>

        {players.list.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <strong style={{ color: '#aaa', fontSize: '0.85rem' }}>Players:</strong>
            <span style={{ color: '#fff', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
              {players.list.join(', ')}
            </span>
          </div>
        )}

        <div
          className="share-link"
          onClick={() => {
            const host = window.location.hostname === 'localhost' ? 'https://dontstarvetogether.gg' : window.location.origin;
            navigator.clipboard.writeText(`${host}/s/${server.share_code}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          Share: <code>/s/{server.share_code}</code>
          <svg className="share-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {copied ? (
              <polyline points="20 6 9 17 4 12" />
            ) : (
              <>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </>
            )}
          </svg>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        defaultActiveTab={getActiveTab()}
        onTabChange={(tabName) => {
          const routes: { [key: string]: string } = {
            'Config': `/servers/${code}/config`,
            'World': `/servers/${code}/world/forest/settings`,
            'Mods': `/servers/${code}/mods`,
            'Logs': `/servers/${code}/logs`,
            'Suggestions': `/servers/${code}/suggestions`,
            'Admins': `/servers/${code}/admins`,
          };
          navigate(routes[tabName]);
        }}
      />

      {children(server, isOwner)}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        body="Are you sure you want to delete this server?"
      />
    </div>
  );
}