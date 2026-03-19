import { useState, useEffect, useCallback } from 'react';
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
  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await api.get('/tokens?available=true');
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // If the current value matches a saved token, stay in select mode
  // If it doesn't match any saved token and is non-empty, switch to new mode
  useEffect(() => {
    if (!value) return;
    const match = tokens.find((t) => t.token === value);
    if (match) {
      setMode('select');
    } else if (tokens.length > 0 && value) {
      setMode('new');
    }
  }, [value, tokens]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'new') {
      setMode('new');
      onChange('');
      return;
    }
    const selected = tokens.find((t) => String(t.id) === val);
    if (selected) {
      onChange(selected.token);
    } else {
      onChange('');
    }
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

  const selectedTokenId = tokens.find((t) => t.token === value)?.id;
  const truncateToken = (token: string) => token.length > 20 ? token.slice(0, 20) + '...' : token;

  return (
    <div className="token-selector">
      {mode === 'select' && tokens.length > 0 ? (
        <>
          <div className="token-selector-row">
            <select
              value={selectedTokenId ? String(selectedTokenId) : ''}
              onChange={handleSelectChange}
              disabled={disabled}
            >
              <option value="">Select a saved token</option>
              {tokens.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.nickname || t.kuid} — {truncateToken(t.token)}
                </option>
              ))}
              <option value="new">Paste new token...</option>
            </select>
          </div>
          {tokens.length > 0 && (
            <div className="token-selector-list">
              {tokens.map((t) => (
                <div key={t.id} className="token-selector-item">
                  <span className="token-selector-label">{t.nickname || t.kuid}</span>
                  <button
                    type="button"
                    className="token-selector-delete"
                    onClick={() => setDeleteId(t.id)}
                    disabled={disabled}
                    title="Delete token"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Paste your cluster token here"
          />
          {tokens.length > 0 && (
            <button
              type="button"
              className="token-selector-toggle"
              onClick={() => { setMode('select'); onChange(''); }}
              disabled={disabled}
            >
              Use saved token
            </button>
          )}
        </>
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
