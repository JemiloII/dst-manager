import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import ServerLayout from '../components/ServerLayout';
import Checkbox from '../components/Checkbox/Checkbox';
import PasswordInput from '../components/PasswordInput';
import PlayStyleSelector, { gameModeOptions, serverIntentionOptions } from '../components/PlayStyleSelector/PlayStyleSelector';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import { toast } from '../utils/toast';

interface Server {
  id: number;
  user_id: number;
  name: string;
  description: string;
  kuid: string;
  share_code: string;
  cluster_token: string;
  cluster_key: string | null;
  max_players: number;
  game_mode: string;
  server_intention: string;
  pvp: number;
  password: string;
  status: string;
}

export default function Config() {
  const { code } = useParams<{ code: string }>();
  const [form, setForm] = useState({ name: '', description: '', gameMode: '', serverIntention: 'cooperative', maxPlayers: 6, pvp: false, password: '', clusterToken: '', clusterKey: '' });
  const [originalForm, setOriginalForm] = useState({ name: '', description: '', gameMode: '', serverIntention: 'cooperative', maxPlayers: 6, pvp: false, password: '', clusterToken: '', clusterKey: '' });
  const [hasChanges, setHasChanges] = useState(false);
  const [serverData, setServerData] = useState<Server | null>(null);
  const [confirmType, setConfirmType] = useState<'token' | 'key' | null>(null);

  // Check if form has changed from original
  useEffect(() => {
    const changed = JSON.stringify(form) !== JSON.stringify(originalForm);
    setHasChanges(changed);
  }, [form, originalForm]);

  const handleRevert = () => {
    setForm(originalForm);
  };

  const doSave = async () => {
    const body: Record<string, any> = {
      name: form.name,
      description: form.description,
      game_mode: form.gameMode,
      server_intention: form.serverIntention,
      max_players: Number(form.maxPlayers),
      pvp: form.pvp ? 1 : 0,
      password: form.password,
    };
    if (form.clusterToken !== originalForm.clusterToken) {
      body.cluster_token = form.clusterToken;
    }
    if (form.clusterKey !== originalForm.clusterKey) {
      body.cluster_key = form.clusterKey;
    }
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
          clusterToken: data.cluster_token || '',
          clusterKey: data.cluster_key || `dst-${data.share_code}`,
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

  const handleSave = async () => {
    if (form.clusterToken !== originalForm.clusterToken) {
      setConfirmType('token');
      return;
    }
    if (form.clusterKey !== originalForm.clusterKey) {
      setConfirmType('key');
      return;
    }
    await doSave();
  };

  const handleConfirm = async () => {
    const type = confirmType;
    setConfirmType(null);
    if (type === 'token' && form.clusterKey !== originalForm.clusterKey) {
      setConfirmType('key');
      return;
    }
    await doSave();
  };

  const handleCancel = () => {
    if (confirmType === 'token') {
      setForm({ ...form, clusterToken: originalForm.clusterToken });
    } else if (confirmType === 'key') {
      setForm({ ...form, clusterKey: originalForm.clusterKey });
    }
    setConfirmType(null);
  };

  const confirmBody = confirmType === 'token'
    ? 'Changing the cluster token may break player data on the server. Do you want to continue?'
    : 'Changing the cluster key will disconnect all currently connected players and may cause issues reconnecting. Do you want to continue?';

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
            clusterToken: server.cluster_token || '',
            clusterKey: server.cluster_key || `dst-${server.share_code}`,
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
        <div className="form-group">
          <label className="label-with-tooltip">
            Cluster Token
            <div className="tooltip-wrapper">
              <button
                type="button"
                className="tooltip-trigger"
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.nextElementSibling;
                  if (tooltip) (tooltip as HTMLElement).style.display = 'block';
                }}
                onMouseLeave={(e) => {
                  const tooltip = e.currentTarget.nextElementSibling;
                  if (tooltip) (tooltip as HTMLElement).style.display = 'none';
                }}
              >
                ?
              </button>
              <div className="tooltip-content">
                <p>Changing the cluster token after setup may break player data on the server.</p>
              </div>
            </div>
          </label>
          <input
            type="text"
            value={form.clusterToken}
            onChange={(e) => setForm({ ...form, clusterToken: e.target.value })}
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
        <div className="form-group">
          <label className="label-with-tooltip">
            Cluster Key
            <div className="tooltip-wrapper">
              <button
                type="button"
                className="tooltip-trigger"
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.nextElementSibling;
                  if (tooltip) (tooltip as HTMLElement).style.display = 'block';
                }}
                onMouseLeave={(e) => {
                  const tooltip = e.currentTarget.nextElementSibling;
                  if (tooltip) (tooltip as HTMLElement).style.display = 'none';
                }}
              >
                ?
              </button>
              <div className="tooltip-content">
                <p>Changing the cluster key will disconnect all currently connected players and may cause issues reconnecting.</p>
              </div>
            </div>
          </label>
          <input
            type="text"
            value={form.clusterKey}
            onChange={(e) => setForm({ ...form, clusterKey: e.target.value })}
            disabled={!isOwner}
          />
        </div>
        <ConfirmModal
          isOpen={!!confirmType}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          body={confirmBody}
        />
          </div>
        );
      }}
    </ServerLayout>
  );
}