import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName: displayName || username }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    login(data.user, data.accessToken, data.refreshToken);
    navigate('/');
  };

  return (
    <div className="auth-container">
      <div className="card">
        <h2>Register</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="displayName">Display Name (optional)</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn-full">Register</button>
        </form>
        <p className="auth-footer-text">
          Already have an account? <Link to="/login">Login</Link>
        </p>
        <p className="auth-terms-text">
          By registering, you agree to our <Link to="/terms" target="_blank">Terms of Service</Link>.<br />
          Users must be 13+ years old.
        </p>
      </div>
    </div>
  );
}
