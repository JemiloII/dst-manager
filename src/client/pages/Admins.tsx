import ServerLayout from '../components/ServerLayout';
import AdminList from '../components/AdminList';

export default function Admins() {
  return (
    <ServerLayout>
      {(server) => (
        server ? <AdminList shareCode={server.share_code} /> : <div>Loading...</div>
      )}
    </ServerLayout>
  );
}
