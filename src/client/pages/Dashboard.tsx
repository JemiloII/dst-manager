import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useServers } from '../stores/Servers';
import { useAuth } from '../stores/Auth';
import { api } from '../api';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
    // Refresh servers to update status
    await fetchServers();
  };

  const handleStop = async (code: string) => {
    await api.post(`/servers/${code}/stop`);
    // Refresh servers to update status
    await fetchServers();
  };

  if (loading) {
    return <div className="card"><p>Loading...</p></div>;
  }

  return (
    <>
      <div className="page-header">
        <h1>Servers</h1>
        {user?.role !== 'guest' && (
          <Link to="/create" className="btn btn-primary"><img src="/images/servericons/dedicated.png" alt="" /> Create Server</Link>
        )}
      </div>
      {servers.length === 0 ? (
        <div className="card">
          <p>No servers yet.</p>
          {user?.role !== 'guest' && (
            <Link to="/create" className="btn btn-primary">Create your first server</Link>
          )}
        </div>
      ) : (
        servers.map((server) => {
          const playerInfo = players[server.id];
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
                  {server.pvp ? <><span className="meta-divider">|</span><span>PvP</span></> : null}
                </div>
              </div>
              <div className="server-actions">
                {user?.role !== 'guest' && (
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
