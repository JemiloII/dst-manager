import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../stores/Auth';
import { api } from '../api';

interface ValidationState {
  code: string | null;
  expiresAt: string | null;
  serverName: string;
}

interface ServerInfo {
  enabled: boolean;
  running: boolean;
  serverName: string;
}

export default function Validation() {
  const { user, updateUser } = useAuth();
  const [state, setState] = useState<ValidationState>({ code: null, expiresAt: null, serverName: '' });
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isValidated, setIsValidated] = useState(user?.isValidated || false);
  const [ign, setIgn] = useState(user?.ign || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/validation/server-info').then((r) => r.json()).then(setServerInfo).catch(() => {});
    api.get('/validation/status').then((r) => r.json()).then((data) => {
      if (data.isValidated) {
        setIsValidated(true);
        setIgn(data.ign);
        updateUser({ isValidated: true, ign: data.ign });
      }
    }).catch(() => {});
  }, [updateUser]);

  const updateCountdown = useCallback(() => {
    if (!state.expiresAt) return;
    const remaining = new Date(state.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setTimeLeft('Expired');
      setState((s) => ({ ...s, code: null, expiresAt: null }));
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
  }, [state.expiresAt]);

  useEffect(() => {
    if (!state.code) return;
    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.code, updateCountdown]);

  useEffect(() => {
    if (!state.code || isValidated) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get('/validation/status');
        const data = await res.json();
        if (data.isValidated) {
          setIsValidated(true);
          setIgn(data.ign);
          updateUser({ isValidated: true, ign: data.ign });
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch { /* ignore */ }
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.code, isValidated, updateUser]);

  const handleRequest = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/validation/request');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setState({ code: data.code, expiresAt: data.expiresAt, serverName: data.serverName });
    } catch {
      setError('Failed to request validation code');
    } finally {
      setLoading(false);
    }
  };

  if (isValidated) {
    return (
      <div className="validation-page">
        <div className="card validation-success">
          <h2>Account Validated</h2>
          <p className="validation-ign">In-Game Name: <strong>{ign}</strong></p>
          <p className="validation-kuid">KUID: <code>{user?.kuid}</code></p>
          <p className="success-message">Your account is verified. You have access to higher server limits.</p>
          <Link to="/" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="validation-page">
      <h1>Account Validation</h1>
      <div className="card">
        <p>Validate your account by proving you own your Klei/Steam account. This unlocks higher server limits.</p>
        {!user?.kuid && (
          <p className="error-message">You need to register a KUID before you can validate. Re-register or contact support.</p>
        )}
        {serverInfo && !serverInfo.enabled && (
          <p className="error-message">Validation system is currently unavailable.</p>
        )}
        {serverInfo && serverInfo.enabled && !serverInfo.running && (
          <p className="error-message">Validation server is starting up. Please try again in a minute.</p>
        )}

        {!state.code ? (
          <button
            className="btn btn-primary"
            onClick={handleRequest}
            disabled={loading || !user?.kuid || !serverInfo?.enabled}
          >
            {loading ? 'Generating...' : 'Get Validation Code'}
          </button>
        ) : (
          <div className="validation-code-section">
            <h3>Your Validation Code</h3>
            <div className="validation-code">{state.code}</div>
            <div className="validation-countdown">Expires in: {timeLeft}</div>
            <div className="validation-instructions">
              <h4>Instructions:</h4>
              <ol>
                <li>Open Don't Starve Together</li>
                <li>Browse servers and join: <strong>{state.serverName}</strong></li>
                <li>Once in-game, open chat and type your code: <code>{state.code}</code></li>
                <li>Wait a few seconds — this page will update automatically</li>
              </ol>
            </div>
            <div className="validation-polling">Checking for validation...</div>
          </div>
        )}

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
