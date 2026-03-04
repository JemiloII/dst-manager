import './PlayStyleSelector.scss';

export interface SelectorOption {
  value: string;
  label: string;
  image: string;
  description: string;
}

export const gameModeOptions: SelectorOption[] = [
  { value: 'relaxed', label: 'Relaxed', image: '/images/serverplaystyles/relaxed.png', description: 'A more forgiving experience. Ghost players can resurrect at will. Perfect for beginners!' },
  { value: 'endless', label: 'Endless', image: '/images/serverplaystyles/endless.png', description: 'Respawn at the portal when you die. Build, explore, and survive together forever!' },
  { value: 'survival', label: 'Survival', image: '/images/serverplaystyles/survival.png', description: 'The ultimate challenge. When you die, the world resets. Test your survival skills!' },
  { value: 'wilderness', label: 'Wilderness', image: '/images/serverplaystyles/wilderness.png', description: 'No structures, no portals. You spawn randomly in the world. Pure survival!' },
  { value: 'lightsout', label: 'Lights Out', image: '/images/serverplaystyles/lightsout.png', description: 'Eternal darkness. Light is your only friend. Can you survive the night?' },
];

export const serverIntentionOptions: SelectorOption[] = [
  { value: 'social', label: 'Social', image: '/images/server_intentions/social.png', description: 'Hang out, chat, and have fun together. No pressure!' },
  { value: 'cooperative', label: 'Cooperative', image: '/images/server_intentions/coop.png', description: 'Work together to survive. Teamwork makes the dream work!' },
  { value: 'competitive', label: 'Competitive', image: '/images/server_intentions/competitive.png', description: 'Test your skills against other players. May the best survivor win!' },
  { value: 'madness', label: 'Madness', image: '/images/server_intentions/madness.png', description: 'Anything goes. Chaos reigns supreme!' },
];

interface PlayStyleSelectorProps {
  options: SelectorOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function PlayStyleSelector({ options, value, onChange }: PlayStyleSelectorProps) {
  return (
    <div className="playstyle-selector">
      <div className="playstyle-grid">
        {options.map((style) => (
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