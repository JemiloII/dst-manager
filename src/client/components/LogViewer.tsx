import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import Tabs from './Tabs';

interface Props {
  serverId: string;
}

export default function LogViewer({ serverId }: Props) {
  const [shard, setShard] = useState<'Master' | 'Caves'>('Master');
  const [logs, setLogs] = useState<{ Master: string; Caves: string }>({
    Master: '',
    Caves: ''
  });
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLog = async () => {
      const res = await api.get(`/logs/${serverId}/${shard}?lines=500`);
      const data = await res.json();
      setLogs(prev => ({ ...prev, [shard]: data.log || '' }));
    };
    fetchLog();
  }, [serverId, shard]);

  // TODO: Implement log streaming endpoint with proper auth headers
  // useEffect(() => {
  //   // EventSource doesn't support custom headers, need different approach
  //   const es = new EventSource(`/api/servers/${serverId}/events`);

  //   es.addEventListener('log', (e) => {
  //     const data = JSON.parse(e.data);
  //     setLogs(prev => ({
  //       ...prev,
  //       [data.shard]: prev[data.shard] + data.data
  //     }));
  //   });

  //   return () => es.close();
  // }, [serverId]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, shard]);

  const handleClear = async () => {
    await api.delete(`/logs/${serverId}/${shard}`);
    setLogs(prev => ({ ...prev, [shard]: '' }));
  };

  const LogContent = ({ type }: { type: 'Master' | 'Caves' }) => (
    <div className="log-viewer-wrapper">
      <button 
        onClick={handleClear} 
        className="icon-btn log-clear-btn"
        title="Clear logs"
      >
        <img src="/images/button_icons/clean_all.png" alt="Clear" />
      </button>
      <div className="log-viewer" ref={type === shard ? logRef : undefined}>
        {logs[type] || 'No logs available.'}
      </div>
    </div>
  );

  return (
    <Tabs
      tabs={['Master', 'Caves']}
      defaultActiveTab={shard === 'Master' ? 0 : 1}
      onTabChange={(tabName) => setShard(tabName as 'Master' | 'Caves')}
    >
      {shard === 'Master' ? (
        <LogContent type="Master" />
      ) : (
        <LogContent type="Caves" />
      )}
    </Tabs>
  );
}