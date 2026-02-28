import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../stores/Auth';
import ServerLayout from '../components/ServerLayout';
import SuggestionsComponent from '../components/Suggestions';

interface Server {
  id: number;
  user_id: number;
  share_code: string;
}

export default function Suggestions() {
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

  if (!server) return <div>Loading...</div>;
  
  const isOwner = user?.id === server.user_id || user?.role === 'admin';

  return (
    <ServerLayout>
      {server && <SuggestionsComponent serverId={server.share_code} isOwner={isOwner} />}
    </ServerLayout>
  );
}