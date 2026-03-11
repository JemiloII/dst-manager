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
  onCopy: (mods: Record<string, ModConfig>, mode: 'replace' | 'merge') => void;
}

export default function ModCopy({ isOpen, onClose, currentServerId, onCopy }: Props) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Server | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(null);
    setLoading(true);
    api.get('/servers')
      .then((r) => r.json())
      .then((data: Server[]) => {
        setServers(data.filter((s) => s.share_code !== currentServerId));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, currentServerId]);

  const handleAction = async (mode: 'replace' | 'merge') => {
    if (!selected) return;
    setFetching(true);
    try {
      const res = await api.get(`/mods/server/${selected.share_code}`);
      if (!res.ok) {
        toast.error('Failed to load mods from that server');
        setFetching(false);
        return;
      }
      const mods = await res.json();
      onCopy(mods, mode);
      onClose();
    } catch {
      toast.error('Failed to load mods from that server');
    }
    setFetching(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Copy Mods From Server">
      {loading ? (
        <p>Loading servers...</p>
      ) : servers.length === 0 ? (
        <p>No other servers found.</p>
      ) : (
        <>
          <div className="copy-mods-list">
            {servers.map((server) => (
              <button
                key={server.id}
                className={`copy-mods-item${selected?.id === server.id ? ' selected' : ''}`}
                onClick={() => setSelected(server)}
              >
                <span className="copy-mods-name">{server.name}</span>
                <span className="copy-mods-count">{server.mod_count} mods</span>
              </button>
            ))}
          </div>
          {selected && (
            <div className="copy-mods-actions">
              <button className="btn btn-danger" disabled={fetching} onClick={() => handleAction('replace')}>
                Replace All Mods
              </button>
              <button className="btn btn-primary" disabled={fetching} onClick={() => handleAction('merge')}>
                Merge Mods
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
