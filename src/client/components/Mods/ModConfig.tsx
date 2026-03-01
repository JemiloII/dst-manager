import { useState } from 'react';
import Modal from '../Modal';
import ConfigOption from './ConfigOption';

interface Props {
  isOpen: boolean;
  modTitle: string;
  options: Record<string, any>;
  currentValues: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  isOwner: boolean;
}

export default function ModConfig({
  isOpen,
  modTitle,
  options,
  currentValues,
  onSave,
  onClose,
  isOwner
}: Props) {
  const [configValues, setConfigValues] = useState<Record<string, unknown>>(currentValues);

  const handleReset = () => {
    const defaultValues: Record<string, any> = {};
    Object.entries(options).forEach(([key, value]) => {
      const option = value as any;
      defaultValues[key] = option.default !== undefined ? option.default : null;
    });
    setConfigValues(defaultValues);
  };

  const handleSave = async () => {
    await onSave(configValues);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure ${modTitle}`}
      footerJSX={
        <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button 
            className="icon-btn" 
            onClick={handleReset}
            title="Reset to Defaults"
          >
            <img src="/images/button_icons/undo.png" alt="Reset" />
          </button>
          <button 
            className="icon-btn" 
            onClick={onClose}
            title="Cancel"
          >
            <img src="/images/button_icons/pinslot_unpin_button.png" alt="Cancel" />
          </button>
          <button 
            className="icon-btn"
            onClick={handleSave}
            title="Save Configuration"
          >
            <img src="/images/button_icons/save.png" alt="Save" />
          </button>
        </div>
      }
    >
      <div className="mod-config-grid">
        {Object.entries(options).length === 0 ? (
          <p className="empty-state">No configuration options available</p>
        ) : (
          Object.entries(options).map(([key, value]) => (
            <ConfigOption
              key={key}
              optionKey={key}
              option={value}
              value={configValues[key]}
              onChange={(k, v) => {
                setConfigValues(prev => ({ ...prev, [k]: v }));
              }}
              isOwner={isOwner}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
