import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { useAuth } from './stores/Auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CreateServer from './pages/CreateServer';
import Config from './pages/Config';
import World from './pages/World';
import Mods from './pages/Mods';
import Logs from './pages/Logs';
import Suggestions from './pages/Suggestions';
import Admins from './pages/Admins';
import Support from './pages/Support';
import Admin from './pages/Admin';
import ShareView from './pages/ShareView';
import Terms from './pages/Terms';
import Validation from './pages/Validation';
// import '@picocss/pico/css/pico.min.css';
import './styles/styles.scss';
import './styles/toast.scss';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  // Wait for auth to load from storage
  if (isLoading) return <div>Loading...</div>;
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
}

function HomeOrDashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  return isAuthenticated ? <Dashboard /> : <Home />;
}

function App() {
  useEffect(() => {
    document.body.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <SnackbarProvider maxSnack={3} autoHideDuration={3000} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/s/:code" element={<ShareView />} />
            <Route path="/" element={<HomeOrDashboard />} />
            <Route path="/create" element={<ProtectedRoute roles={['admin', 'user']}><CreateServer /></ProtectedRoute>} />
            <Route path="/servers/:code" element={<ProtectedRoute><Config /></ProtectedRoute>} />
            <Route path="/servers/:code/config" element={<ProtectedRoute><Config /></ProtectedRoute>} />
            <Route path="/servers/:code/world/:shard/:subtab" element={<ProtectedRoute><World /></ProtectedRoute>} />
            <Route path="/servers/:code/mods" element={<ProtectedRoute><Mods /></ProtectedRoute>} />
            <Route path="/servers/:code/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
            <Route path="/servers/:code/suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
            <Route path="/servers/:code/admins" element={<ProtectedRoute><Admins /></ProtectedRoute>} />
            <Route path="/validate" element={<ProtectedRoute roles={['admin', 'user']}><Validation /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SnackbarProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
