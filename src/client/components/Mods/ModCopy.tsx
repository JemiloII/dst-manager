import { useState, useEffect } from 'react';
import Modal from '../Modal';
import { api } from '../../api';
import { toast } from '../../utils/toast';
import { ModConfig } from './types';

interface Server {
  id: number;
  name: string;
  share_code: string;
  mod_count: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentServerId: string;
  onCopy: (mods: Record<string, ModConfig>) => void;
}

export default function ModCopy({ isOpen, onClose, currentServerId, onCopy }: Props) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.get('/servers')
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data.filter((s) => s.share_code !== currentServerId));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, currentServerId]);

  const handleSelect = async (server: Server) => {
    try {
      const res = await api.get(`/mods/server/${server.share_code}`);
      if (!res.ok) {
        toast.error('Failed to load mods from that server');
        return;
      }
      const mods = await res.json();
      onCopy(mods);
      onClose();
    } catch {
      toast.error('Failed to load mods from that server');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Copy Mods From Server">
      {loading ? (
        <p>Loading servers...</p>
      ) : servers.length === 0 ? (
        <p>No other servers found.</p>
      ) : (
        <div className="copy-mods-list">
          {servers.map((server) => (
            <button key={server.id} className="copy-mods-item" onClick={() => handleSelect(server)}>
              <span className="copy-mods-name">{server.name}</span>
              <span className="copy-mods-count">{server.mod_count} mods</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
