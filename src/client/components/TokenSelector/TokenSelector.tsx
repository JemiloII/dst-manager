import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../api';
import { toast } from '../../utils/toast';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import './TokenSelector.scss';

interface SavedToken {
  id: number;
  token: string;
  kuid: string;
  nickname: string;
  created_at: string;
}

interface TokenSelectorProps {
  value: string;
  onChange: (token: string) => void;
  disabled?: boolean;
}

export default function TokenSelector({ value, onChange, disabled }: TokenSelectorProps) {
  const [tokens, setTokens] = useState<SavedToken[]>([]);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await api.get('/tokens?available=true');
      if (res.ok) setTokens(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (token: SavedToken) => {
    onChange(token.token);
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await api.delete(`/tokens/${deleteId}`);
      if (res.ok) {
        toast.success('Token deleted');
        const deleted = tokens.find((t) => t.id === deleteId);
        if (deleted && deleted.token === value) onChange('');
        await fetchTokens();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete token');
      }
    } catch {
      toast.error('Failed to delete token');
    }
    setDeleteId(null);
  };

  const truncate = (t: string) => t.length > 40 ? t.slice(0, 40) + '...' : t;

  return (
    <div className="token-selector" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Paste your cluster token here"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
      />
      {open && tokens.length > 0 && (
        <div className="token-dropdown">
          {tokens.map((t) => (
            <div key={t.id} className="token-dropdown-item">
              <button
                type="button"
                className="token-dropdown-select"
                onClick={() => handleSelect(t)}
              >
                {truncate(t.token)}
              </button>
              <button
                type="button"
                className="token-dropdown-delete"
                onClick={(e) => { e.stopPropagation(); setDeleteId(t.id); }}
                title="Delete token"
              >
                <img src="/images/button_icons/delete.png" alt="Delete" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="form-hint">
        Get your token from{' '}
        <a href="https://accounts.klei.com/account/game/servers?game=DontStarveTogether" target="_blank" rel="noopener noreferrer">
          Klei Account
        </a>
      </p>
      <ConfirmModal
        isOpen={deleteId !== null}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        body="Are you sure you want to delete this saved token?"
      />
    </div>
  );
}
