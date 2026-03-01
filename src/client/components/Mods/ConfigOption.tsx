import CycleSelector from '../CycleSelector/CycleSelector';

interface ConfigOptionProps {
  optionKey: string;
  option: any;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  isOwner: boolean;
}

export default function ConfigOption({
  optionKey,
  option,
  value,
  onChange,
  isOwner
}: ConfigOptionProps) {
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
    <div className="config-option">
      <div className="config-info">
        <label>{option.label || optionKey}</label>
        {option.description && (
          <p className="config-description">{option.description}</p>
        )}
      </div>
      <CycleSelector
        label=""
        value={value}
        options={formattedOptions.map((opt: any) => opt.value)}
        optionLabels={formattedOptions.reduce((acc: any, opt: any) => ({
          ...acc,
          [opt.value]: opt.label
        }), {})}
        onChange={(newValue) => onChange(optionKey, newValue)}
        disabled={!isOwner}
      />
    </div>
  );
}