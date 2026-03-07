import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Checkbox from '../components/Checkbox/Checkbox';
import PasswordInput from '../components/PasswordInput';
import PlayStyleSelector, { gameModeOptions, serverIntentionOptions } from '../components/PlayStyleSelector/PlayStyleSelector';
import { toast } from '../utils/toast';

export default function CreateServer() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [clusterToken, setClusterToken] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState('endless');
  const [serverIntention, setServerIntention] = useState('cooperative');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [pvp, setPvp] = useState(false);
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await api.post('/servers', {
      name,
      clusterToken,
      description,
      gameMode,
      serverIntention,
      maxPlayers,
      pvp,
      password,
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error);
      return;
    }

    navigate(`/servers/${data.shareCode}`);
  };

  return (
    <div className="create-server-container">
      <h1>Create Server</h1>
      <div className="card">
        <form onSubmit={handleSubmit} className="create-server-form">
          <div className="form-group">
            <label htmlFor="name">Server Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="clusterToken" className="label-with-tooltip">
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
                  <p>Where to find your cluster token:</p>
                  <img src="/images/dst_cluster_token_example.png" alt="Cluster Token Example" />
                </div>
              </div>
            </label>
            <input
              id="clusterToken"
              type="text"
              value={clusterToken}
              onChange={(e) => setClusterToken(e.target.value)}
              required
              placeholder="Paste your cluster token here"
            />
            <p className="form-hint">
              Get your token from{' '}
              <a href="https://accounts.klei.com/account/game/servers?game=DontStarveTogether" target="_blank" rel="noopener noreferrer">
                Klei Account
              </a>
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Server description"
            />
          </div>

          <div className="form-group form-group-full">
            <label>Game Mode</label>
            <PlayStyleSelector options={gameModeOptions} value={gameMode} onChange={setGameMode} />
          </div>

          <div className="form-group form-group-full">
            <label>Server Intention</label>
            <PlayStyleSelector options={serverIntentionOptions} value={serverIntention} onChange={setServerIntention} />
          </div>

          <div className="form-group">
            <label htmlFor="maxPlayers">Max Players: {maxPlayers}</label>
            <input
              id="maxPlayers"
              type="range"
              min={1}
              max={64}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
            />
          </div>

          <div className="form-group">
            <Checkbox
              label="PvP"
              checked={pvp}
              onChange={setPvp}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Server Password (optional)</label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit">Create Server</button>
        </form>
      </div>
    </div>
  );
}
