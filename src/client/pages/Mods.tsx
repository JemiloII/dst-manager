import { useParams } from 'react-router-dom';
import ServerLayout from '../components/ServerLayout';
import { ModManager } from '../components/Mods';

export default function Mods() {
  const { code } = useParams<{ code: string }>();

  const handleSaveMods = async () => {
    // This will be handled by ModManager component
    console.log('Save mods triggered from layout');
  };

  return (
    <ServerLayout onSave={handleSaveMods} saveTitle="Save Mods">
      {(server, isOwner) => (
        code ? <ModManager serverId={code} isOwner={isOwner} /> : null
      )}
    </ServerLayout>
  );
}