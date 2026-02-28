import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/Auth';
import WorldSettings from '../components/WorldSettings';
import Tabs from '../components/Tabs';
import ConfirmModal from '../components/ConfirmModal';

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
}

export default function World() {
  const { code, shard, subtab } = useParams<{ code: string; shard?: string; subtab?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const worldSaveRef = useRef<(() => void) | undefined>();
  const [server, setServer] = useState<Server | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [players, setPlayers] = useState<{ count: number; max: number; list: string[] }>({ count: 0, max: 0, list: [] });

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

  useEffect(() => {
    if (!code) return;
    const token = localStorage.getItem('accessToken');
    const es = new EventSource(`/api/servers/${code}/events${token ? `?token=${token}` : ''}`);

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setServer((prev) => prev ? { ...prev, status: data.data } : null);
    });

    es.addEventListener('players', (e) => {
      const data = JSON.parse(e.data);
      setPlayers(data.data);
    });

    return () => es.close();
  }, [code]);

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

  const handleSaveWorld = () => {
    if (worldSaveRef.current) {
      worldSaveRef.current();
    }
  };

  const handleExport = () => {
    window.open(`/api/servers/${code}/export?token=${localStorage.getItem('accessToken')}`, '_blank');
  };

  if (!server) return <div>Loading...</div>;

  const isOwner = user?.id === server.user_id || user?.role === 'admin';

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
              <button className="icon-btn" onClick={handleSaveWorld} title="Save World Settings">
                <img src="/images/button_icons/save.png" alt="Save" />
              </button>
              <button className="icon-btn" onClick={() => setShowDeleteConfirm(true)} title="Delete">
                <img src="/images/button_icons/delete.png" alt="Delete" />
              </button>
              <button className="icon-btn" onClick={handleExport} title="Export">
                <img src="/images/button_icons/folder.png" alt="Export" />
              </button>
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

        <div style={{ marginTop: '0.75rem', color: '#aaa', fontSize: '0.85rem' }}>
          Share: <code style={{ color: '#FF8A00' }}>/s/{server.share_code}</code>
        </div>
      </div>

      <Tabs
        tabs={['Config', 'World', 'Mods', 'Logs', 'Suggestions']}
        defaultActiveTab={1}
        onTabChange={(tabName) => {
          const routes: { [key: string]: string } = {
            'Config': `/servers/${code}/config`,
            'World': `/servers/${code}/world/forest/settings`,
            'Mods': `/servers/${code}/mods`,
            'Logs': `/servers/${code}/logs`,
            'Suggestions': `/servers/${code}/suggestions`
          };
          navigate(routes[tabName]);
        }}
      />

      {server && <WorldSettings serverId={server.share_code} isOwner={isOwner} saveRef={worldSaveRef} />}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this server?"
      />
    </div>
  );
}