import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useServers } from '../stores/servers';
import { useAuth } from '../stores/auth';
import { api } from '../api';

export default function Dashboard() {
  const { servers, players, loading, fetchServers, updateStatus, updatePlayers } = useServers();
  const { user } = useAuth();

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    if (servers.length === 0) return;

    const eventSources: EventSource[] = [];

    for (const server of servers) {
      const token = localStorage.getItem('accessToken');
      const es = new EventSource(`/api/servers/${server.id}/events${token ? `?token=${token}` : ''}`);

      es.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        updateStatus(server.id, data.data);
      });

      es.addEventListener('players', (e) => {
        const data = JSON.parse(e.data);
        updatePlayers(server.id, data.data);
      });

      eventSources.push(es);
    }

    return () => {
      eventSources.forEach((es) => es.close());
    };
  }, [servers.length, updateStatus, updatePlayers]);

  const handleStart = async (id: number) => {
    await api.post(`/servers/${id}/start`);
  };

  const handleStop = async (id: number) => {
    await api.post(`/servers/${id}/stop`);
  };

  if (loading) {
    return <div className="card"><p>Loading...</p></div>;
  }

  return (
    <>
      <h1 style={{ color: '#fff' }}>Servers</h1>
      {servers.length === 0 ? (
        <div className="card">
          <p>No servers yet.</p>
          {user?.role !== 'guest' && (
            <Link to="/servers/create">
              <button>Create your first server</button>
            </Link>
          )}
        </div>
      ) : (
        servers.map((server) => {
          const playerInfo = players[server.id];
          return (
            <div key={server.id} className="server-card">
              <div className="server-info">
                <h3>
                  <Link to={`/servers/${server.id}`} style={{ color: '#fff', textDecoration: 'none' }}>
                    {server.name}
                  </Link>
                </h3>
                <div className="server-meta">
                  <span className={`status-badge ${server.status}`}>{server.status}</span>
                  <span>{server.game_mode}</span>
                  <span>
                    {playerInfo ? `${playerInfo.count}/${playerInfo.max}` : `0/${server.max_players}`} players
                  </span>
                  {server.pvp ? <span>PvP</span> : null}
                </div>
              </div>
              <div className="server-actions">
                {user?.role !== 'guest' && (
                  <>
                    {server.status === 'stopped' ? (
                      <button className="icon-btn" onClick={() => handleStart(server.id)} title="Start">
                        <img src="/button_icons/AFKstart.png" alt="Start" />
                      </button>
                    ) : (
                      <button className="icon-btn" onClick={() => handleStop(server.id)} title="Stop">
                        <img src="/button_icons/AFKstop.png" alt="Stop" />
                      </button>
                    )}
                  </>
                )}
                <Link to={`/servers/${server.id}`}>
                  <button className="icon-btn" title="Details">
                    <img src="/button_icons/more_info.png" alt="Details" />
                  </button>
                </Link>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
