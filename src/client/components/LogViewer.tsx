import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import Tabs from './Tabs';

interface Props {
  serverId: string;
  serverStatus?: string;
}

export default function LogViewer({ serverId, serverStatus }: Props) {
  const [shard, setShard] = useState<'Master' | 'Caves'>('Master');
  const [logs, setLogs] = useState<{ Master: string; Caves: string }>({
    Master: '',
    Caves: ''
  });
  const logRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Fetch initial logs
  useEffect(() => {
    const fetchLog = async () => {
      const res = await api.get(`/logs/${serverId}/${shard}?lines=500`);
      const data = await res.json();
      setLogs(prev => ({ ...prev, [shard]: data.log || '' }));
    };
    fetchLog();
  }, [serverId, shard]);

  // SSE streaming when server is running
  useEffect(() => {
    if (serverStatus !== 'running') return;

    const token = localStorage.getItem('accessToken');
    const url = `/api/logs/${serverId}/${shard}/stream${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('log', (e) => {
      setLogs(prev => ({
        ...prev,
        [shard]: prev[shard as keyof typeof prev] + e.data
      }));
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [serverId, shard, serverStatus]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, shard]);

  const handleClear = useCallback(async () => {
    await api.delete(`/logs/${serverId}/${shard}`);
    setLogs(prev => ({ ...prev, [shard]: '' }));
  }, [serverId, shard]);

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
