import './CycleSelector.scss';

interface CycleSelectorProps {
  label: string;
  value: string | number | boolean;
  options: (string | number | boolean)[];
  optionLabels?: Record<string | number, string>;
  onChange: (value: string | number | boolean) => void;
  className?: string;
  disabled?: boolean;
}

export default function CycleSelector({ label, value, options, optionLabels, onChange, className = '', disabled = false }: CycleSelectorProps) {
  const currentIndex = options.indexOf(value);
  const validIndex = currentIndex >= 0 ? currentIndex : 0;
  
  const handlePrev = () => {
    if (!disabled) {
      const prevIndex = validIndex > 0 ? validIndex - 1 : options.length - 1;
      onChange(options[prevIndex]);
    }
  };
  
  const handleNext = () => {
    if (!disabled) {
      const nextIndex = (validIndex + 1) % options.length;
      onChange(options[nextIndex]);
    }
  };
  
  const displayValue = optionLabels?.[String(value)] || String(value);
  
  return (
    <div className={`cycle-selector ${className} ${disabled ? 'cycle-selector--disabled' : ''}`}>
      {label && (
        <label className="cycle-selector-label">
          {label}
        </label>
      )}
      <div className="cycle-selector-control">
        {!disabled && (
          <button 
            type="button"
            className="arrow-btn arrow-btn-left"
            onClick={handlePrev}
          >
            ◀
          </button>
        )}
        <span className="cycle-selector-value">
          {displayValue}
        </span>
        {!disabled && (
          <button 
            type="button"
            className="arrow-btn arrow-btn-right"
            onClick={handleNext}
          >
            ▶
          </button>
        )}
      </div>
    </div>
  );
}