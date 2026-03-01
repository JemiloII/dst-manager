import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useServers } from '../stores/Servers';
import { useAuth } from '../stores/Auth';
import { api } from '../api';

export default function Dashboard() {
  const { servers, players, loading, fetchServers, updateStatus, updatePlayers } = useServers();
  const { user } = useAuth();

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // TODO: Implement server events endpoint with proper auth headers
  // useEffect(() => {
  //   if (servers.length === 0) return;

  //   const eventSources: EventSource[] = [];

  //   for (const server of servers) {
  //     // EventSource doesn't support custom headers, need different approach
  //     const es = new EventSource(`/api/servers/${server.id}/events`);

  //     es.addEventListener('status', (e) => {
  //       const data = JSON.parse(e.data);
  //       updateStatus(server.id, data.data);
  //     });

  //     es.addEventListener('players', (e) => {
  //       const data = JSON.parse(e.data);
  //       updatePlayers(server.id, data.data);
  //     });

  //     eventSources.push(es);
  //   }

  //   return () => {
  //     eventSources.forEach((es) => es.close());
  //   };
  // }, [servers.length, updateStatus, updatePlayers]);

  const handleStart = async (code: string) => {
    await api.post(`/servers/${code}/start`);
  };

  const handleStop = async (code: string) => {
    await api.post(`/servers/${code}/stop`);
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
            <Link to="/create">
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
                  <Link to={`/servers/${server.share_code}`} style={{ color: '#fff', textDecoration: 'none' }}>
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
                      <button className="icon-btn" onClick={() => handleStart(server.share_code)} title="Start">
                        <img src="/images/button_icons/AFKstart.png" alt="Start" />
                      </button>
                    ) : (
                      <button className="icon-btn" onClick={() => handleStop(server.share_code)} title="Stop">
                        <img src="/images/button_icons/AFKstop.png" alt="Stop" />
                      </button>
                    )}
                  </>
                )}
                <Link to={`/servers/${server.share_code}`}>
                  <button className="icon-btn" title="Details">
                    <img src="/images/button_icons/more_info.png" alt="Details" />
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
