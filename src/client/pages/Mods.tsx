import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/Auth';
import ServerLayout from '../components/ServerLayout';
import ModManager from '../components/ModManager';

interface Server {
  share_code: string;
}

export default function Mods() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
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

  const handleSaveMods = async () => {
    // This will be handled by ModManager component
    console.log('Save mods triggered from layout');
  };

  if (!server) return <div>Loading...</div>;

  return (
    <ServerLayout onSave={handleSaveMods} saveTitle="Save Mods">
      {server && <ModManager serverId={server.share_code} />}
    </ServerLayout>
  );
}