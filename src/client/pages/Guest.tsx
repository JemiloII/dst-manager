import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/Auth';

export default function Guest() {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    login({ ...data.user, displayName }, data.accessToken, data.refreshToken);
    navigate('/');
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h2>Join as Guest</h2>
        <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>
          As a guest, you can view servers and suggest mods for server owners to approve.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit">Enter</button>
        </form>
      </div>
    </div>
  );
}
