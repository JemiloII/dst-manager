import { useParams } from 'react-router-dom';
import ServerLayout from '../components/ServerLayout';
import LogViewer from '../components/LogViewer';

export default function Logs() {
  const { code } = useParams<{ code: string }>();

  return (
    <ServerLayout>
      {(server, isOwner) => (
        code ? <LogViewer serverId={code} /> : null
      )}
    </ServerLayout>
  );
}