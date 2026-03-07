import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import ServerLayout from '../components/ServerLayout';
import Checkbox from '../components/Checkbox/Checkbox';
import PasswordInput from '../components/PasswordInput';
import PlayStyleSelector, { gameModeOptions, serverIntentionOptions } from '../components/PlayStyleSelector/PlayStyleSelector';
import { toast } from '../utils/toast';

interface Server {
  id: number;
  user_id: number;
  name: string;
  description: string;
  kuid: string;
  share_code: string;
  max_players: number;
  game_mode: string;
  server_intention: string;
  pvp: number;
  password: string;
  status: string;
}

export default function Config() {
  const { code } = useParams<{ code: string }>();
  const [form, setForm] = useState({ name: '', description: '', gameMode: '', serverIntention: 'cooperative', maxPlayers: 6, pvp: false, password: '' });
  const [originalForm, setOriginalForm] = useState({ name: '', description: '', gameMode: '', serverIntention: 'cooperative', maxPlayers: 6, pvp: false, password: '' });
  const [hasChanges, setHasChanges] = useState(false);
  const [serverData, setServerData] = useState<Server | null>(null);

  // Check if form has changed from original
  useEffect(() => {
    const changed = JSON.stringify(form) !== JSON.stringify(originalForm);
    setHasChanges(changed);
  }, [form, originalForm]);

  const handleRevert = () => {
    setForm(originalForm);
  };

  const handleSave = async () => {
    const body = {
      name: form.name,
      description: form.description,
      game_mode: form.gameMode,
      server_intention: form.serverIntention,
      max_players: Number(form.maxPlayers),
      pvp: form.pvp ? 1 : 0,
      password: form.password,
    };
    try {
      const res = await api.put(`/servers/${code}`, body);
      if (res.ok) {
        const data = await res.json();
        setServerData(data);
        const updatedForm = {
          name: data.name,
          description: data.description,
          gameMode: data.game_mode,
          serverIntention: data.server_intention || 'cooperative',
          maxPlayers: data.max_players,
          pvp: !!data.pvp,
          password: data.password,
        };
        setForm(updatedForm);
        setOriginalForm(updatedForm);
        toast.success('Config saved');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save config');
      }
    } catch {
      toast.error('Failed to save config');
    }
  };

  return (
    <ServerLayout onSave={handleSave} onRevert={handleRevert} saveTitle="Save" hasChanges={hasChanges}>
      {(server, isOwner) => {
        // Initialize form when server data comes from ServerLayout
        if (server && !serverData) {
          const formData = {
            name: server.name,
            description: server.description,
            gameMode: server.game_mode,
            serverIntention: server.server_intention || 'cooperative',
            maxPlayers: server.max_players,
            pvp: !!server.pvp,
            password: server.password,
          };
          setForm(formData);
          setOriginalForm(formData);
          setServerData(server);
        }
        
        if (!server) return <div>Loading...</div>;
        
        return (
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
        <div className="form-group form-group-full">
          <label>Game Mode</label>
          {isOwner ? (
            <PlayStyleSelector
              options={gameModeOptions}
              value={form.gameMode}
              onChange={(value) => setForm({ ...form, gameMode: value })}
            />
          ) : (
            <p>{form.gameMode}</p>
          )}
        </div>
        <div className="form-group form-group-full">
          <label>Server Intention</label>
          {isOwner ? (
            <PlayStyleSelector
              options={serverIntentionOptions}
              value={form.serverIntention}
              onChange={(value) => setForm({ ...form, serverIntention: value })}
            />
          ) : (
            <p>{form.serverIntention}</p>
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
          <PasswordInput
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={!isOwner}
          />
        </div>
          </div>
        );
      }}
    </ServerLayout>
  );
}