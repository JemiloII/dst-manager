import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/Auth';
import Tabs from '../components/Tabs';
import Checkbox from '../components/Checkbox/Checkbox';
import ConfirmModal from '../components/ConfirmModal';
import PlayStyleSelector from '../components/PlayStyleSelector/PlayStyleSelector';

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

export default function Config() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', gameMode: '', maxPlayers: 6, pvp: false, password: '' });
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
      setForm({
        name: data.name,
        description: data.description,
        gameMode: data.game_mode,
        maxPlayers: data.max_players,
        pvp: !!data.pvp,
        password: data.password,
      });
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

  const handleSave = async () => {
    const body = {
      name: form.name,
      description: form.description,
      game_mode: form.gameMode,
      max_players: Number(form.maxPlayers),
      pvp: form.pvp ? 1 : 0,
      password: form.password,
    };
    console.log('Saving with body:', body);
    try {
      const res = await api.put(`/servers/${code}`, body);
      if (res.ok) {
        const data = await res.json();
        setServer(data);
        setForm({
          name: data.name,
          description: data.description,
          gameMode: data.game_mode,
          maxPlayers: data.max_players,
          pvp: !!data.pvp,
          password: data.password,
        });
        console.log('Save successful');
      } else {
        const error = await res.json();
        console.error('Save failed:', error);
      }
    } catch (err) {
      console.error('Save error:', err);
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
              <button className="icon-btn" onClick={handleSave} title="Save">
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
        defaultActiveTab={0}
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

      <div className="card">
        <div className="form-group">
          <label>Name</label>
          <input 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
            disabled={!isOwner}
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input 
            value={form.description} 
            onChange={(e) => setForm({ ...form, description: e.target.value })} 
            disabled={!isOwner}
          />
        </div>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label>Game Mode</label>
          {isOwner ? (
            <PlayStyleSelector 
              value={form.gameMode} 
              onChange={(value) => setForm({ ...form, gameMode: value })} 
            />
          ) : (
            <p>{form.gameMode}</p>
          )}
        </div>
        <div className="form-group">
          <label>Max Players: {form.maxPlayers}</label>
          {isOwner ? (
            <input
              type="range"
              min={1}
              max={64}
              value={form.maxPlayers}
              onChange={(e) => setForm({ ...form, maxPlayers: parseInt(e.target.value, 10) || 1 })}
            />
          ) : (
            <p>{form.maxPlayers}</p>
          )}
        </div>
        <div className="form-group">
          <Checkbox
            label="PvP"
            checked={form.pvp}
            onChange={(checked) => setForm({ ...form, pvp: checked })}
            disabled={!isOwner}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showPassword ? 'text' : 'password'}
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              disabled={!isOwner}
              style={{ paddingRight: '40px', flex: 1 }}
            />
            {isOwner && (
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </>
                  ) : (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </>
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        message="Are you sure you want to delete this server?"
      />
    </div>
  );
}