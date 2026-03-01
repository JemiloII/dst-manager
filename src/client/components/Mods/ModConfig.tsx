import { useState } from 'react';
import Modal from '../Modal';
import CycleSelector from '../CycleSelector/CycleSelector';

interface Props {
  isOpen: boolean;
  modKey: string;
  modTitle: string;
  options: Record<string, any>;
  currentValues: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  isOwner: boolean;
}

export default function ModConfig({
  isOpen,
  modKey,
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
          Object.entries(options).map(([key, value]) => {
            const option = value as any;
            const currentValue = configValues[key];
            
            // Only show options that have an options array (selectable values)
            if (!option.options || !Array.isArray(option.options)) {
              return null;
            }
            
            // Format options for CycleSelector
            const formattedOptions = option.options.map((opt: any) => ({
              value: opt.data,
              label: opt.description
            }));
            
            return (
              <div key={key} className="config-option">
                <div className="config-info">
                  <label>{option.label || key}</label>
                  {option.description && (
                    <p className="config-description">{option.description}</p>
                  )}
                </div>
                <CycleSelector
                  label=""
                  value={currentValue}
                  options={formattedOptions.map((opt: any) => opt.value)}
                  optionLabels={formattedOptions.reduce((acc: any, opt: any) => {
                    acc[opt.value] = opt.label;
                    return acc;
                  }, {})}
                  onChange={(newValue) => {
                    setConfigValues(prev => ({
                      ...prev,
                      [key]: newValue
                    }));
                  }}
                  disabled={!isOwner}
                />
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}