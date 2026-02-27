import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Checkbox from '../components/Checkbox';

export default function CreateServer() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [clusterToken, setClusterToken] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState('endless');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [pvp, setPvp] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await api.post('/servers', {
      name,
      clusterToken,
      description,
      gameMode,
      maxPlayers,
      pvp,
      password,
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    navigate(`/servers/${data.id}`);
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
            <label htmlFor="clusterToken" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Cluster Token
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid #FF8A00',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    color: '#FF8A00',
                    cursor: 'help',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
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
                <div
                  style={{
                    position: 'absolute',
                    display: 'none',
                    top: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    background: 'rgba(0, 0, 0, 0.95)',
                    border: '1px solid #FF8A00',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    minWidth: '400px',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem', color: '#fff', fontSize: '0.85rem' }}>Where to find your cluster token:</p>
                  <img
                    src="/images/dst_cluster_token_example.png"
                    alt="Cluster Token Example"
                    style={{ width: '100%', borderRadius: '4px' }}
                  />
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
            <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.25rem' }}>
              Get your token from{' '}
              <a
                href="https://accounts.klei.com/account/game/servers?game=DontStarveTogether"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#FF8A00' }}
              >
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

          <div className="form-group">
            <label htmlFor="gameMode">Game Mode</label>
            <select id="gameMode" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
              <option value="survival">Survival</option>
              <option value="endless">Endless</option>
              <option value="wilderness">Wilderness</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="maxPlayers">Max Players</label>
            <input
              id="maxPlayers"
              type="number"
              min={1}
              max={64}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
            />
          </div>

          <div className="form-group">
            <Checkbox
              label="PvP Enabled"
              checked={pvp}
              onChange={setPvp}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Server Password (optional)</label>
            <input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="error-message">{error}</p>}
          <button type="submit">Create Server</button>
        </form>
      </div>
    </div>
  );
}
