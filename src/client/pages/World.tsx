import ServerLayout from '../components/ServerLayout';
import WorldSettings from '../components/WorldSettings';

export default function World() {
  const handleSaveWorld = async () => {
    // This will be handled by WorldSettings component
    console.log('Save world settings triggered from layout');
  };

  return (
    <ServerLayout onSave={handleSaveWorld} saveTitle="Save World Settings">
      {(server, isOwner) => (
        server ? <WorldSettings serverId={server.share_code} /> : <div>Loading...</div>
      )}
    </ServerLayout>
  );
}