import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServers } from '../stores/Servers';
import { useAuth } from '../stores/Auth';
import { usePreferences } from '../stores/Preferences';
import { api } from '../api';
import CycleSelector from '../components/CycleSelector/CycleSelector';
import { formatRuntime, capitalize } from '../utils/formatRuntime';

const STATUS_OPTIONS = ['all', 'running', 'stopped'];
const STATUS_LABELS: Record<string, string> = { all: 'All', running: 'Running', stopped: 'Stopped' };
const ROLE_OPTIONS = ['all', 'owned', 'admin'];
const ROLE_LABELS: Record<string, string> = { all: 'All', owned: 'Owned', admin: 'Admin' };
const SORT_OPTIONS = ['az', 'players', 'runtime', 'status'];
const SORT_LABELS: Record<string, string> = { az: 'A-Z', players: 'Players', runtime: 'Runtime', status: 'Status' };

interface ServerLimits {
  maxServers: number;
  maxRunning: number;
  ownedCount: number;
  runningCount: number;
  isValidated: boolean;
  kuid: string | null;
}

export default function Dashboard() {
  const { servers, players, loading, fetchServers } = useServers();
  const { user } = useAuth();
  const { preferences, loaded: prefsLoaded, fetchPreferences, setPreference } = usePreferences();
  const [limits, setLimits] = useState<ServerLimits | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchServers();
    if (user?.role !== 'guest') {
      api.get('/servers/limits').then((r) => r.json()).then(setLimits).catch(() => {});
    }
  }, [fetchServers, user?.role]);

  // SSE for real-time status updates
  const { updateStatus, updatePlayers } = useServers();
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const es = new EventSource(`/api/servers/events?token=${token}`);

    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      updateStatus(data.serverId, data.data);
    });

    es.addEventListener('players', (e) => {
      const data = JSON.parse(e.data);
      updatePlayers(data.serverId, data.data);
    });

    return () => es.close();
  }, [updateStatus, updatePlayers]);

  useEffect(() => {
    if (!prefsLoaded) fetchPreferences();
  }, [prefsLoaded, fetchPreferences]);

  const [, setTick] = useState(0);
  const hasRunning = servers.some((s) => s.started_at);

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [hasRunning]);

  const statusFilter = preferences.dashboard_status || 'all';
  const roleFilter = preferences.dashboard_role || 'all';
  const sortBy = preferences.dashboard_sort || 'az';

  const filtered = useMemo(() => {
    const statusOrder: Record<string, number> = { running: 0, starting: 1, paused: 2, stopped: 3 };

    const list = servers.filter((server) => {
      if (statusFilter === 'running' && server.status === 'stopped') return false;
      if (statusFilter === 'stopped' && server.status !== 'stopped') return false;
      if (user?.role !== 'admin') {
        if (roleFilter === 'owned' && server.user_id !== user?.id) return false;
        if (roleFilter === 'admin' && server.user_id === user?.id) return false;
      }
      return true;
    });

    const now = Date.now();
    return [...list].sort((a, b) => {
      if (sortBy === 'players') {
        const aPlayers = players[a.id]?.count ?? 0;
        const bPlayers = players[b.id]?.count ?? 0;
        return bPlayers - aPlayers || a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      if (sortBy === 'runtime') {
        const aRuntime = a.started_at ? now - new Date(a.started_at).getTime() : 0;
        const bRuntime = b.started_at ? now - new Date(b.started_at).getTime() : 0;
        return bRuntime - aRuntime || a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      if (sortBy === 'status') {
        const diff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        return diff || a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [servers, players, statusFilter, roleFilter, sortBy, user?.id, user?.role]);

  const handleStart = async (code: string) => {
    setActionError('');
    const res = await api.post(`/servers/${code}/start`);
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error || 'Failed to start server');
      return;
    }
    await fetchServers();
  };

  const handleStop = async (code: string) => {
    setActionError('');
    await api.post(`/servers/${code}/stop`);
    await fetchServers();
  };

  if (loading) {
    return <div className="card"><p>Loading...</p></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Servers</h1>
        {servers.length > 0 && (
          <div className="dashboard-filters">
            <CycleSelector
              label="Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              optionLabels={STATUS_LABELS}
              onChange={(v) => setPreference('dashboard_status', v as string)}
            />
            <CycleSelector
              label="Role"
              value={roleFilter}
              options={ROLE_OPTIONS}
              optionLabels={ROLE_LABELS}
              onChange={(v) => setPreference('dashboard_role', v as string)}
            />
            <CycleSelector
              label="Sort"
              value={sortBy}
              options={SORT_OPTIONS}
              optionLabels={SORT_LABELS}
              onChange={(v) => setPreference('dashboard_sort', v as string)}
            />
          </div>
        )}
        {user?.role !== 'guest' && (
          <div className="dashboard-header-actions">
            {limits && limits.maxServers !== -1 && (
              <span className="server-count-badge">Servers: {limits.ownedCount}/{limits.maxServers}</span>
            )}
            {limits && limits.maxServers !== -1 && limits.ownedCount >= limits.maxServers ? (
              <span className="btn btn-secondary btn-disabled">Server Limit Reached</span>
            ) : (
              <Link to="/create" className="btn btn-primary"><img src="/images/servericons/dedicated.png" alt="" /> Create Server</Link>
            )}
          </div>
        )}
      </div>
      {actionError && <div className="card error-banner"><p className="error-message">{actionError}</p></div>}
      {limits && !limits.isValidated && user?.role !== 'admin' && (
        <div className="card validation-banner">
          <p>
            <Link to="/validate">Validate your account</Link> to create more servers and run more simultaneously.
          </p>
        </div>
      )}
      {servers.length === 0 ? (
        <div className="card">
          <p>No servers yet.</p>
          {user?.role !== 'guest' && (
            <Link to="/create" className="btn btn-primary">Create your first server</Link>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <p>No servers match your filters.</p>
        </div>
      ) : (
        filtered.map((server) => {
          const playerInfo = players[server.id];
          const canControl = server.user_id === user?.id || user?.role === 'admin';
          return (
            <Link key={server.id} to={`/servers/${server.share_code}`} className="server-card">
              <div className="server-card-icon">
                <img
                  src={`/images/serverplaystyles/${server.game_mode}_small.png`}
                  alt={capitalize(server.game_mode)}
                  title={capitalize(server.game_mode)}
                />
              </div>
              <div className="server-info">
                <h3>{server.name}</h3>
                <div className="server-meta">
                  <span className={`status-badge ${server.status}`}>{server.status}</span>
                  <span>{capitalize(server.game_mode)}</span>
                  <span className="meta-divider">|</span>
                  <span>Mods: {server.mod_count || 0}</span>
                  <span className="meta-divider">|</span>
                  <span>
                    Players: {playerInfo ? `${playerInfo.count}/${playerInfo.max}` : `0/${server.max_players}`}
                  </span>
                  {server.started_at ? <><span className="meta-divider">|</span><span>{formatRuntime(server.started_at)}</span></> : null}
                  {server.pvp ? <><span className="meta-divider">|</span><span>PvP</span></> : null}
                </div>
              </div>
              <div className="server-actions">
                {canControl && (
                  <>
                    {server.status === 'stopped' ? (
                      <button className="icon-btn" onClick={(e) => { e.preventDefault(); handleStart(server.share_code); }} title="Start">
                        <img src="/images/button_icons/AFKstart.png" alt="Start" />
                      </button>
                    ) : (
                      <button className="icon-btn" onClick={(e) => { e.preventDefault(); handleStop(server.share_code); }} title="Stop">
                        <img src="/images/button_icons/AFKstop.png" alt="Stop" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </Link>
          );
        })
      )}
    </>
  );
}
