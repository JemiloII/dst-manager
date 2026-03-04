import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/Auth';

export default function Layout() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
    </>
  );
}
