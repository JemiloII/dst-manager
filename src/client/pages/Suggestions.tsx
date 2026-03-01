import ServerLayout from '../components/ServerLayout';
import SuggestionsComponent from '../components/Suggestions';

export default function Suggestions() {
  return (
    <ServerLayout>
      {(server, isOwner) => (
        server ? <SuggestionsComponent serverId={server.share_code} isOwner={isOwner} /> : <div>Loading...</div>
      )}
    </ServerLayout>
  );
}