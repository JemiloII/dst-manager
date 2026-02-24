import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

interface Props {
  serverId: number;
}

export default function LogViewer({ serverId }: Props) {
  const [shard, setShard] = useState<'Master' | 'Caves'>('Master');
  const [log, setLog] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLog = async () => {
      const res = await api.get(`/logs/${serverId}/${shard}?lines=500`);
      const data = await res.json();
      setLog(data.log || '');
    };
    fetchLog();
  }, [serverId, shard]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const es = new EventSource(`/api/servers/${serverId}/events${token ? `?token=${token}` : ''}`);

    es.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      if (data.shard === shard) {
        setLog((prev) => prev + data.data);
      }
    });

    return () => es.close();
  }, [serverId, shard]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const handleClear = async () => {
    await api.delete(`/logs/${serverId}/${shard}`);
    setLog('');
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={shard === 'Master' ? 'active' : ''} onClick={() => setShard('Master')}>Master</button>
          <button className={shard === 'Caves' ? 'active' : ''} onClick={() => setShard('Caves')}>Caves</button>
        </div>
        <button onClick={handleClear} style={{ fontSize: '0.85rem' }}>
          <img src="/button_icons/clean_all.png" alt="" style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: '0.25rem' }} />
          Clear
        </button>
      </div>
      <div className="log-viewer" ref={logRef}>
        {log || 'No logs available.'}
      </div>
    </>
  );
}
