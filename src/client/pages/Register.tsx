import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../stores/Auth';
import PasswordInput from '../components/PasswordInput';
import './Register.scss';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [kuid, setKuid] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (kuid && !/^KU_[A-Za-z0-9_-]+$/.test(kuid)) {
      setError('Invalid KUID format. Must start with KU_ followed by alphanumeric characters.');
      return;
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName: displayName || username, kuid: kuid || undefined }),
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
            <label htmlFor="kuid" className="label-with-tooltip">
              KUID
              <span className="tooltip-wrapper">
                <button type="button" className="tooltip-trigger" onMouseEnter={(e) => { const el = e.currentTarget.nextElementSibling as HTMLElement; if (el) el.style.display = 'block'; }} onMouseLeave={(e) => { const el = e.currentTarget.nextElementSibling as HTMLElement; if (el) el.style.display = 'none'; }}>?</button>
                <span className="tooltip-content">
                  <p>Find your KUID at <a href="https://accounts.klei.com" target="_blank" rel="noreferrer">accounts.klei.com</a></p>
                </span>
              </span>
            </label>
            <input
              id="kuid"
              type="text"
              value={kuid}
              onChange={(e) => setKuid(e.target.value)}
              placeholder="KU_xxxxxxxx"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
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
