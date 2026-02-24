import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/auth';
import WorldSettings from '../components/WorldSettings';
import ModManager from '../components/ModManager';
import LogViewer from '../components/LogViewer';
import Suggestions from '../components/Suggestions';

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

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [tab, setTab] = useState<'overview' | 'world' | 'mods' | 'logs' | 'suggestions'>('overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', gameMode: '', maxPlayers: 6, pvp: false, password: '' });
  const [players, setPlayers] = useState<{ count: number; max: number; list: string[] }>({ count: 0, max: 0, list: [] });

  useEffect(() => {
    const fetchServer = async () => {
      const res = await api.get(`/servers/${id}`);
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
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken');
    const es = new EventSource(`/api/servers/${id}/events${token ? `?token=${token}` : ''}`);

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setServer((prev) => prev ? { ...prev, status: data.data } : null);
    });

    es.addEventListener('players', (e) => {
      const data = JSON.parse(e.data);
      setPlayers(data.data);
    });

    return () => es.close();
  }, [id]);

  const handleSave = async () => {
    await api.put(`/servers/${id}`, form);
    setEditing(false);
    const res = await api.get(`/servers/${id}`);
    setServer(await res.json());
  };

  const handleStart = async () => {
    await api.post(`/servers/${id}/start`);
  };

  const handleStop = async () => {
    await api.post(`/servers/${id}/stop`);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this server? This cannot be undone.')) return;
    await api.delete(`/servers/${id}`);
    navigate('/');
  };

  const handleExport = () => {
    const token = localStorage.getItem('accessToken');
    window.open(`/api/admin/export/${id}?token=${token}`, '_blank');
  };

  if (!server) return <div className="card"><p>Loading...</p></div>;

  const isOwner = user?.role === 'admin' || user?.id === server.user_id;

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff' }}>{server.name}</h2>
            <span className={`status-badge ${server.status}`}>{server.status}</span>
            <span style={{ color: '#aaa', marginLeft: '1rem', fontSize: '0.85rem' }}>
              {players.count}/{server.max_players} players
            </span>
          </div>
          {isOwner && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {server.status === 'stopped' ? (
                <button className="icon-btn" onClick={handleStart} title="Start">
                  <img src="/button_icons/AFKstart.png" alt="Start" />
                </button>
              ) : (
                <button className="icon-btn" onClick={handleStop} title="Stop">
                  <img src="/button_icons/AFKstop.png" alt="Stop" />
                </button>
              )}
              <button className="icon-btn" onClick={handleExport} title="Export">
                <img src="/button_icons/folder.png" alt="Export" />
              </button>
              <button className="icon-btn" onClick={handleDelete} title="Delete">
                <img src="/button_icons/delete.png" alt="Delete" />
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

      <div className="tab-bar">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Config</button>
        <button className={tab === 'world' ? 'active' : ''} onClick={() => setTab('world')}>World</button>
        <button className={tab === 'mods' ? 'active' : ''} onClick={() => setTab('mods')}>Mods</button>
        <button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}>Logs</button>
        <button className={tab === 'suggestions' ? 'active' : ''} onClick={() => setTab('suggestions')}>Suggestions</button>
      </div>

      {tab === 'overview' && (
        <div className="card">
          {editing ? (
            <>
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Game Mode</label>
                <select value={form.gameMode} onChange={(e) => setForm({ ...form, gameMode: e.target.value })}>
                  <option value="survival">Survival</option>
                  <option value="endless">Endless</option>
                  <option value="wilderness">Wilderness</option>
                </select>
              </div>
              <div className="form-group">
                <label>Max Players</label>
                <input type="number" min={1} max={64} value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: parseInt(e.target.value) })} />
              </div>
              <div className="form-group">
                <label><input type="checkbox" checked={form.pvp} onChange={(e) => setForm({ ...form, pvp: e.target.checked })} /> PvP</label>
              </div>
              <div className="form-group">
                <label>Password</label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleSave}>Save</button>
                <button onClick={() => setEditing(false)} style={{ background: '#666' }}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p><strong>Description:</strong> {server.description || 'None'}</p>
              <p><strong>Game Mode:</strong> {server.game_mode}</p>
              <p><strong>Max Players:</strong> {server.max_players}</p>
              <p><strong>PvP:</strong> {server.pvp ? 'Yes' : 'No'}</p>
              <p><strong>Password:</strong> {server.password ? '***' : 'None'}</p>
              <p><strong>KUID:</strong> {server.kuid}</p>
              {isOwner && <button onClick={() => setEditing(true)}>Edit</button>}
            </>
          )}
        </div>
      )}

      {tab === 'world' && <WorldSettings serverId={parseInt(id!)} isOwner={isOwner} />}
      {tab === 'mods' && <ModManager serverId={parseInt(id!)} isOwner={isOwner} />}
      {tab === 'logs' && <LogViewer serverId={parseInt(id!)} />}
      {tab === 'suggestions' && <Suggestions serverId={parseInt(id!)} isOwner={isOwner} />}
    </>
  );
}
