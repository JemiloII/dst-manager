import './PlayStyleSelector.scss';

interface PlaystyleOption {
  value: string;
  label: string;
  image: string;
  description: string;
}

const playstyles: PlaystyleOption[] = [
  {
    value: 'relaxed',
    label: 'Relaxed',
    image: '/images/serverplaystyles/relaxed.png',
    description: 'A more forgiving experience. Ghost players can resurrect at will. Perfect for beginners!'
  },
  {
    value: 'endless',
    label: 'Endless', 
    image: '/images/serverplaystyles/endless.png',
    description: 'Respawn at the portal when you die. Build, explore, and survive together forever!'
  },
  {
    value: 'survival',
    label: 'Survival',
    image: '/images/serverplaystyles/survival.png',
    description: 'The ultimate challenge. When you die, the world resets. Test your survival skills!'
  },
  {
    value: 'wilderness',
    label: 'Wilderness',
    image: '/images/serverplaystyles/wilderness.png',
    description: 'No structures, no portals. You spawn randomly in the world. Pure survival!'
  },
  {
    value: 'lightsout',
    label: 'Lights Out',
    image: '/images/serverplaystyles/lightsout.png',
    description: 'Eternal darkness. Light is your only friend. Can you survive the night?'
  }
];

interface PlayStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function PlayStyleSelector({ value, onChange }: PlayStyleSelectorProps) {
  return (
    <div className="playstyle-selector">
      <div className="playstyle-grid">
        {playstyles.map((style) => (
          <div
            key={style.value}
            className={`playstyle-option ${value === style.value ? 'selected' : ''}`}
            onClick={() => onChange(style.value)}
          >
            <div className="playstyle-frame">
              <img 
                src={style.image} 
                alt={style.label}
                className="playstyle-image"
              />
            </div>
            <div className="playstyle-info">
              <h3>{style.label}</h3>
              <p>{style.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}