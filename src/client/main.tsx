import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './stores/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateServer from './pages/CreateServer';
import ServerDetail from './pages/ServerDetail';
import Support from './pages/Support';
import Admin from './pages/Admin';
import ShareView from './pages/ShareView';
import Terms from './pages/Terms';
// import '@picocss/pico/css/pico.min.css';
import './styles/global.scss';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
}

function App() {
  const { loadFromStorage } = useAuth();

  useEffect(() => {
    loadFromStorage();
    document.body.setAttribute('data-theme', 'dark');
  }, [loadFromStorage]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/s/:code" element={<ShareView />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/servers/create" element={<ProtectedRoute roles={['admin', 'user']}><CreateServer /></ProtectedRoute>} />
          <Route path="/servers/:id" element={<ProtectedRoute><ServerDetail /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
