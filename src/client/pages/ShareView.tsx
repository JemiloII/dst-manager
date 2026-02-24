import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/auth';

interface SharedServer {
  id: number;
  name: string;
  description: string;
  max_players: number;
  game_mode: string;
  pvp: number;
  status: string;
  share_code: string;
}

function GuestLogin({ shareCode, serverId }: { shareCode: string; serverId: number }) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, shareCode }),
    });

    const data = await res.json();
    setLoading(false);
    
    if (!res.ok) {
      setError(data.error);
      return;
    }

    login({ ...data.user, displayName }, data.accessToken, data.refreshToken);
    navigate(`/servers/${serverId}`);
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid #333', paddingTop: '1rem' }}>
      <h4 style={{ color: '#FF8A00', marginBottom: '0.5rem' }}>Join as Guest</h4>
      <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Enter a display name to suggest mods for this server
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Joining...' : 'Join'}
        </button>
      </form>
      {error && <p style={{ color: '#f44', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
      <p style={{ fontSize: '0.7rem', color: '#555', marginTop: '0.5rem' }}>
        By joining, you agree to our <Link to="/terms" target="_blank">Terms</Link>. Users must be 13+.
      </p>
    </div>
  );
}

export default function ShareView() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const [server, setServer] = useState<SharedServer | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchServer = async () => {
      const res = await api.get(`/servers/shared/${code}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      setServer(await res.json());
    };
    fetchServer();
  }, [code]);

  if (notFound) {
    return (
      <div className="card" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2 style={{ color: '#fff' }}>Server Not Found</h2>
        <p style={{ color: '#aaa' }}>This share link is invalid or expired.</p>
        <Link to="/">Go Home</Link>
      </div>
    );
  }

  if (!server) {
    return <div className="card"><p>Loading...</p></div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto' }}>
      <div className="card">
        <h2 style={{ color: '#fff', margin: '0 0 0.5rem' }}>{server.name}</h2>
        <span className={`status-badge ${server.status}`}>{server.status}</span>

        <div style={{ marginTop: '1rem', color: '#ccc' }}>
          <p><strong>Description:</strong> {server.description || 'None'}</p>
          <p><strong>Game Mode:</strong> {server.game_mode}</p>
          <p><strong>Max Players:</strong> {server.max_players}</p>
          <p><strong>PvP:</strong> {server.pvp ? 'Yes' : 'No'}</p>
        </div>

        {user ? (
          <div style={{ marginTop: '1rem' }}>
            <Link to={`/servers/${server.id}`}>
              <button>View Full Details</button>
            </Link>
          </div>
        ) : (
          <GuestLogin shareCode={code!} serverId={server.id} />
        )}
      </div>
    </div>
  );
}
