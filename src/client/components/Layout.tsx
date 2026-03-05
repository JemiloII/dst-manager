import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/Auth';
import { api } from '../api';
import Modal from './Modal';

export default function Layout() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeUsername, setUpgradeUsername] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeError, setUpgradeError] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpgradeError('');
    setUpgradeLoading(true);

    const res = await api.post('/auth/upgrade', {
      username: upgradeUsername,
      password: upgradePassword,
    });

    const data = await res.json();
    setUpgradeLoading(false);

    if (!res.ok) {
      setUpgradeError(data.error);
      return;
    }

    login(data.user, data.accessToken, data.refreshToken);
    setShowUpgrade(false);
    setUpgradeUsername('');
    setUpgradePassword('');
  };

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <>
      <div className="vignette" />
      <nav>
        <Link to="/" className="nav-brand">DST Server Manager</Link>
        <div className="nav-links">
          {isAuthenticated ? (
            <>
              <Link to="/" className={isActive('/')}>Servers</Link>
              <Link to="/support" className={isActive('/support')}>Support</Link>
              {user?.role === 'guest' && (
                <a onClick={() => setShowUpgrade(true)} className="nav-upgrade">Create Account</a>
              )}
              <span className="nav-username">{user?.username}</span>
              <a onClick={handleLogout} className="nav-logout">Logout</a>
            </>
          ) : (
            <>
              <Link to="/login" className={isActive('/login')}>Login</Link>
              <Link to="/register" className={isActive('/register')}>Register</Link>
            </>
          )}
        </div>
      </nav>
      <div className="container main-content">
        <Outlet />
      </div>
      <footer className="site-footer">
        <p>
          {user?.role === 'admin' && (
            <><Link to="/admin" className="footer-link">Admin</Link> | </>
          )}
          <Link to="/terms" className="footer-link">Terms of Service</Link> | dst.gg © {new Date().getFullYear()}
        </p>
      </footer>

      <Modal
        isOpen={showUpgrade}
        onClose={() => { setShowUpgrade(false); setUpgradeError(''); }}
        title="Create Account"
      >
        <p className="upgrade-modal-desc">
          Set a username and password to upgrade your guest account. You'll keep access to all your joined servers.
        </p>
        <form onSubmit={handleUpgrade}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={upgradeUsername}
              onChange={(e) => setUpgradeUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={upgradePassword}
              onChange={(e) => setUpgradePassword(e.target.value)}
              required
            />
          </div>
          {upgradeError && <p className="error-message">{upgradeError}</p>}
          <button type="submit" disabled={upgradeLoading} className="btn btn-primary btn-full">
            {upgradeLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </Modal>
    </>
  );
}
