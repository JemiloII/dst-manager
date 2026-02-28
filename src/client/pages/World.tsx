import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import ServerLayout from '../components/ServerLayout';
import WorldSettings from '../components/WorldSettings';

interface Server {
  share_code: string;
}

export default function World() {
  const { code } = useParams<{ code: string }>();
  const [server, setServer] = useState<Server | null>(null);

  useEffect(() => {
    const fetchServer = async () => {
      const res = await api.get(`/servers/${code}`);
      if (!res.ok) return;
      const data = await res.json();
      setServer(data);
    };
    fetchServer();
  }, [code]);

  const handleSaveWorld = async () => {
    // This will be handled by WorldSettings component
    console.log('Save world settings triggered from layout');
  };

  if (!server) return <div>Loading...</div>;

  return (
    <ServerLayout onSave={handleSaveWorld} saveTitle="Save World Settings">
      {server && <WorldSettings serverId={server.share_code} />}
    </ServerLayout>
  );
}