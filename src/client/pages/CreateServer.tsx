import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function CreateServer() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [clusterToken, setClusterToken] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState('survival');
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
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ color: '#fff' }}>Create Server</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
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
            <label htmlFor="clusterToken">Cluster Token</label>
            <textarea
              id="clusterToken"
              value={clusterToken}
              onChange={(e) => setClusterToken(e.target.value)}
              rows={3}
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
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
            <label>
              <input
                type="checkbox"
                checked={pvp}
                onChange={(e) => setPvp(e.target.checked)}
              />
              PvP Enabled
            </label>
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
