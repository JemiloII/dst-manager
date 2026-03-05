import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/Auth';
import Checkbox from '../components/Checkbox/Checkbox';
import PasswordInput from '../components/PasswordInput';
import { gameModeOptions, serverIntentionOptions } from '../components/PlayStyleSelector/PlayStyleSelector';

interface SharedServer {
  id: number;
  name: string;
  description: string;
  max_players: number;
  game_mode: string;
  server_intention: string;
  pvp: number;
  status: string;
  share_code: string;
}

function GuestLogin({ shareCode }: { shareCode: string }) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body: Record<string, string> = { displayName, shareCode };
    if (createAccount) {
      if (!password) {
        setError('Password required for account creation');
        setLoading(false);
        return;
      }
      body.username = displayName;
      body.password = password;
    }

    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    login({ ...data.user, displayName }, data.accessToken, data.refreshToken);
    navigate(`/servers/${shareCode}`);
  };

  return (
    <div className="guest-login">
      <div className="guest-login-header">
        <h4 className="guest-login-title">Join as Guest</h4>
        <Checkbox
          label="Create an account"
          checked={createAccount}
          onChange={setCreateAccount}
        />
      </div>
      <p className="guest-login-desc">Enter a display name to suggest mods for this server</p>
      <form onSubmit={handleSubmit} className="guest-login-form">
        <input
          type="text"
          placeholder="Your name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        {createAccount && (
          <div className="guest-account-fields">
            <PasswordInput
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary btn-full">
          {loading ? 'Joining...' : createAccount ? 'Create Account & Join' : 'Join'}
        </button>
      </form>
      {error && <p className="error-message">{error}</p>}
      <p className="guest-login-terms">
        By joining, you agree to our <Link to="/terms" target="_blank">Terms</Link>. Users must be 13+.
      </p>
    </div>
  );
}

function JoinButton({ shareCode }: { shareCode: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoin = async () => {
    setLoading(true);
    setError('');
    const res = await api.post(`/servers/${shareCode}/join`);
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      // If already owner or member, just navigate
      if (res.status === 400) {
        navigate(`/servers/${shareCode}`);
        return;
      }
      setError(data.error);
      return;
    }
    navigate(`/servers/${shareCode}`);
  };

  return (
    <div className="share-view-actions">
      <button onClick={handleJoin} disabled={loading} className="btn btn-primary">
        {loading ? 'Joining...' : 'Join Server'}
      </button>
      <Link to={`/servers/${shareCode}`} className="btn btn-secondary">
        View Full Details
      </Link>
      {error && <p className="error-message">{error}</p>}
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
      <div className="share-view">
        <div className="card share-view-not-found">
          <h2>Server Not Found</h2>
          <p>This share link is invalid or expired.</p>
          <Link to="/">Go Home</Link>
        </div>
      </div>
    );
  }

  if (!server) {
    return <div className="card"><p>Loading...</p></div>;
  }

  return (
    <div className="share-view">
      <div className="card">
        <div className="share-view-header">
          <h2 className="share-view-title">{server.name}</h2>
          <span className={`status-badge ${server.status}`}>{server.status}</span>
        </div>

        <div className="share-view-styles">
          {(() => {
            const mode = gameModeOptions.find((o) => o.value === server.game_mode);
            const intention = serverIntentionOptions.find((o) => o.value === server.server_intention);
            return (
              <>
                {mode && (
                  <div className="share-view-style-item">
                    <div className="share-view-style-frame">
                      <img src={mode.image} alt={mode.label} />
                    </div>
                    <span>{mode.label}</span>
                  </div>
                )}
                {intention && (
                  <div className="share-view-style-item">
                    <div className="share-view-style-frame share-view-style-frame--intention">
                      <img src={intention.image} alt={intention.label} />
                    </div>
                    <span>{intention.label}</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="share-view-details">
          {server.description && <p>{server.description}</p>}
          <p><strong>Max Players:</strong> {server.max_players}</p>
          <p><strong>PvP:</strong> {server.pvp ? 'Yes' : 'No'}</p>
        </div>

        {user ? (
          <JoinButton shareCode={code!} />
        ) : (
          <GuestLogin shareCode={code!} />
        )}
      </div>
    </div>
  );
}
