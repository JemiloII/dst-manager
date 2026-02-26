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
              <Link to="/" className={isActive('/')}>Dashboard</Link>
              {user?.role !== 'guest' && (
                <Link to="/create" className={isActive('/create')}>Create Server</Link>
              )}
              <Link to="/support" className={isActive('/support')}>Support</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className={isActive('/admin')}>Admin</Link>
              )}
              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                {user?.username}
              </span>
              <button onClick={handleLogout} className="icon-btn" style={{ color: '#ccc', fontSize: '0.85rem' }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={isActive('/login')}>Login</Link>
              <Link to="/register" className={isActive('/register')}>Register</Link>
            </>
          )}
        </div>
      </nav>
      <div className="container" style={{ flex: '1' }}>
        <Outlet />
      </div>
      <footer style={{ 
        textAlign: 'center', 
        padding: '2rem 1rem', 
        borderTop: '1px solid #222', 
        marginTop: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: '#666',
        fontSize: '0.8rem'
      }}>
        <p style={{ margin: 0 }}>
          <Link to="/terms" style={{ color: '#888', transition: 'color 0.2s' }} 
            onMouseEnter={(e) => e.currentTarget.style.color = '#FF8A00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#888'}>
            Terms of Service
          </Link> | dst.gg © {new Date().getFullYear()}
        </p>
      </footer>
    </>
  );
}
