import { useState, useEffect } from 'react';
import { api } from '../api';

const OVERRIDE_ICONS: Record<string, string> = {
  alternatehunt: 'alternatehunt', angrybees: 'angry_bees', antliontribute: 'antlion_tribute',
  autumn: 'autumn', bats_setting: 'bats', bearger: 'bearger', beefalo: 'beefalo',
  beefaloheat: 'beefaloheat', beequeen: 'beehive', bees: 'bees', bees_setting: 'bees',
  berrybush: 'berrybush', birds: 'birds', branching: 'world_branching',
  bunnymen_setting: 'bunnymen', butterfly: 'butterfly', buzzard: 'buzzard',
  cactus: 'cactus', carrot: 'carrot', catcoon: 'catcoon', catcoons: 'catcoon',
  chess: 'chess_monsters', darkness: 'day', day: 'day', deerclops: 'deerclops',
  dragonfly: 'dragonfly', flint: 'flint', flowers: 'flowers', frograin: 'frog_rain',
  frogs: 'frogs', goosemoose: 'goosemoose', grass: 'grass', houndmound: 'houndmound',
  hounds: 'hounds', hunt: 'koalafants', krampus: 'krampus', liefs: 'liefs',
  lightning: 'lightning', lightninggoat: 'lightning_goat', loop: 'world_loop',
  lureplants: 'lureplant', marshbush: 'marsh_bush', merm: 'merms', merms: 'merms',
  meteorshowers: 'meteor', moles: 'mole', moles_setting: 'mole', mosquitos: 'mosquitos',
  mushroom: 'mushrooms', penguins: 'pengull', perd: 'perd', pigs: 'pigs',
  pigs_setting: 'pigs', ponds: 'ponds', rabbits: 'rabbits', rabbits_setting: 'rabbits',
  reeds: 'reeds', regrowth: 'regrowth', rock: 'rocks', rock_ice: 'iceboulder',
  sapling: 'sapling', season_start: 'season_start', shadowcreatures: 'smoke',
  spiderqueen: 'spiders', spiders: 'spiders', spiders_setting: 'spiders',
  spring: 'spring', summer: 'summer', tallbirds: 'tallbirds', tentacles: 'tentacles',
  trees: 'trees', tumbleweed: 'tumbleweeds', walrus: 'mactusk', walrus_setting: 'mactusk',
  weather: 'rain', wildfires: 'burntground', winter: 'winter', world_size: 'world_size',
};

const VALUE_OPTIONS = ['never', 'rare', 'default', 'often', 'always'];
const SEASON_OPTIONS = ['noseason', 'veryshortseason', 'shortseason', 'default', 'longseason', 'verylongseason'];

function getOptionsForKey(key: string): string[] {
  if (['autumn', 'winter', 'spring', 'summer'].includes(key)) return SEASON_OPTIONS;
  if (key === 'world_size') return ['small', 'medium', 'default', 'large', 'huge'];
  if (key === 'day') return ['default', 'longday', 'longdusk', 'longnight', 'noday', 'nodusk', 'nonight', 'onlyday', 'onlydusk', 'onlynight'];
  if (key === 'season_start') return ['default', 'autumn', 'winter', 'spring', 'summer'];
  return VALUE_OPTIONS;
}

interface Props {
  serverId: number;
  isOwner: boolean;
}

export default function WorldSettings({ serverId, isOwner }: Props) {
  const [shard, setShard] = useState<'Master' | 'Caves'>('Master');
  const [overrides, setOverrides] = useState<Record<string, string | boolean | number>>({});
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const res = await api.get(`/world/${serverId}/${shard}`);
      const data = await res.json();
      setOverrides(data.overrides || {});
      setRawText(data.raw || '');
    };
    fetchData();
  }, [serverId, shard]);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const body = rawMode ? { raw: rawText } : { overrides };
    const res = await api.put(`/world/${serverId}/${shard}`, body);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
    } else {
      setSuccess('Saved!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const updateOverride = (key: string, value: string) => {
    setOverrides({ ...overrides, [key]: value });
  };

  const overrideKeys = Object.keys(overrides).filter((k) => typeof overrides[k] === 'string');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={shard === 'Master' ? 'active' : ''} onClick={() => setShard('Master')}>Master</button>
          <button className={shard === 'Caves' ? 'active' : ''} onClick={() => setShard('Caves')}>Caves</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setRawMode(!rawMode)} style={{ fontSize: '0.85rem' }}>
            {rawMode ? 'Visual Editor' : 'Raw Paste'}
          </button>
          {isOwner && <button onClick={handleSave}>Save</button>}
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {rawMode ? (
        <div className="card">
          <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Paste your leveldataoverride.lua content. Only safe key/value pairs will be extracted.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={20}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
            disabled={!isOwner}
          />
        </div>
      ) : (
        <div className="world-settings-grid">
          {overrideKeys.map((key) => {
            const iconName = OVERRIDE_ICONS[key];
            const options = getOptionsForKey(key);
            return (
              <div key={key} className="world-setting-item">
                {iconName && (
                  <img src={`/customisation/${iconName}.png`} alt={key} />
                )}
                <div className="setting-info">
                  <label>{key.replace(/_/g, ' ')}</label>
                  <select
                    value={overrides[key] as string}
                    onChange={(e) => updateOverride(key, e.target.value)}
                    disabled={!isOwner}
                  >
                    {options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {!options.includes(overrides[key] as string) && (
                      <option value={overrides[key] as string}>{overrides[key] as string}</option>
                    )}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
