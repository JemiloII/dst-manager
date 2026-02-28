import { useParams } from 'react-router-dom';
import ServerLayout from '../components/ServerLayout';
import LogViewer from '../components/LogViewer';

export default function Logs() {
  const { code } = useParams<{ code: string }>();

  return (
    <ServerLayout>
      {code && <LogViewer serverId={code} />}
    </ServerLayout>
  );
}