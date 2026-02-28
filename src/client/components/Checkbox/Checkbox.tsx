import './Checkbox.scss';

interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function Checkbox({ label, checked, onChange, disabled = false }: Props) {
  return (
    <div className={`custom-checkbox ${disabled ? 'disabled' : ''}`}>
      <label className="checkbox-label">
        <span className="checkbox-text">{label}</span>
        <button
          type="button"
          className="checkbox-icon"
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
        >
          <img 
            src={checked ? '/images/button_icons/enabled_filter.png' : '/images/button_icons/disabled_filter.png'} 
            alt={checked ? 'Enabled' : 'Disabled'} 
          />
        </button>
      </label>
    </div>
  );
}