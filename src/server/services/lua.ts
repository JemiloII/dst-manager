const VALID_VALUE_PATTERN = /^("[^"]*"|true|false|-?\d+\.?\d*|[a-z_]+)$/;

const FORBIDDEN_KEYWORDS = [
  'function', 'require', 'dofile', 'loadfile', 'loadstring', 'load',
  'os', 'io', 'debug', 'rawset', 'rawget', 'setmetatable', 'getmetatable',
  'pcall', 'xpcall', 'coroutine', 'package', 'module', 'setfenv', 'getfenv',
];

export function parseLuaOverrides(lua: string): Record<string, string | boolean | number> | null {
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(lua)) {
      return null;
    }
  }

  const overrides: Record<string, string | boolean | number> = {};

  const overridesMatch = lua.match(/overrides\s*=\s*\{([\s\S]*?)\}/);
  if (!overridesMatch) return overrides;

  const content = overridesMatch[1];
  const entryPattern = /(\w+)\s*=\s*([^,\n}]+)/g;
  let match;

  while ((match = entryPattern.exec(content)) !== null) {
    const key = match[1].trim();
    const rawValue = match[2].trim();

    if (!VALID_VALUE_PATTERN.test(rawValue)) continue;

    if (rawValue === 'true') {
      overrides[key] = true;
    } else if (rawValue === 'false') {
      overrides[key] = false;
    } else if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      overrides[key] = rawValue.slice(1, -1);
    } else if (!isNaN(Number(rawValue))) {
      overrides[key] = Number(rawValue);
    } else {
      overrides[key] = rawValue;
    }
  }

  return overrides;
}

export function generateLevelDataOverride(
  templateLua: string,
  overrides: Record<string, string | boolean | number>,
  playstyle?: string
): string {
  // Parse the template to get all default overrides
  const templateOverrides = parseLuaOverrides(templateLua) || {};

  // Merge user overrides on top of template defaults
  const merged = { ...templateOverrides, ...overrides };

  // Replace only the overrides block and playstyle in the template
  let result = templateLua;

  // Build new overrides block
  const overrideLines: string[] = [];
  const sortedKeys = Object.keys(merged).sort();
  for (const key of sortedKeys) {
    const val = merged[key];
    if (typeof val === 'string') {
      overrideLines.push(`    ${key}="${val}",`);
    } else {
      overrideLines.push(`    ${key}=${val},`);
    }
  }
  const newOverridesBlock = `overrides={\n${overrideLines.join('\n')}\n  }`;

  // Replace the overrides block in the template
  result = result.replace(/overrides\s*=\s*\{[\s\S]*?\n\s*\}/, newOverridesBlock);

  // Replace playstyle if provided
  if (playstyle) {
    if (result.includes('playstyle=')) {
      result = result.replace(/playstyle="[^"]*"/, `playstyle="${playstyle}"`);
    } else {
      result = result.replace(/version=4,/, `playstyle="${playstyle}",\n  version=4,`);
    }
  }

  return result;
}

export function parseModOverrides(lua: string): Record<string, { enabled: boolean; configuration_options: Record<string, unknown> }> | null {
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(lua)) {
      return null;
    }
  }

  const mods: Record<string, { enabled: boolean; configuration_options: Record<string, unknown> }> = {};
  
  // More robust pattern that handles nested braces
  const modPattern = /\["(workshop-\d+)"\]\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;

  while ((match = modPattern.exec(lua)) !== null) {
    const modId = match[1];
    const body = match[2];

    const enabledMatch = body.match(/enabled\s*=\s*(true|false)/);
    const enabled = enabledMatch ? enabledMatch[1] === 'true' : false;

    const configOptions: Record<string, unknown> = {};
    const configMatch = body.match(/configuration_options\s*=\s*\{([\s\S]*?)\}/);
    if (configMatch) {
      const configContent = configMatch[1];
      const optPattern = /(\[?"?[\w\s]*"?\]?|\w+)\s*=\s*([^,}]+)/g;
      let optMatch;
      while ((optMatch = optPattern.exec(configContent)) !== null) {
        let optKey = optMatch[1].trim();
        const optVal = optMatch[2].trim();

        if (optKey.startsWith('["') && optKey.endsWith('"]')) {
          optKey = optKey.slice(2, -2);
        }

        if (optVal === 'true') configOptions[optKey] = true;
        else if (optVal === 'false') configOptions[optKey] = false;
        else if (!isNaN(Number(optVal))) configOptions[optKey] = Number(optVal);
        else if (optVal.startsWith('"') && optVal.endsWith('"')) configOptions[optKey] = optVal.slice(1, -1);
        else configOptions[optKey] = optVal;
      }
    }

    mods[modId] = { enabled, configuration_options: configOptions };
  }

  return mods;
}

export function generateModOverrides(
  mods: Record<string, { enabled: boolean; configuration_options: Record<string, unknown> }>
): string {
  const lines: string[] = ['return {'];
  const modIds = Object.keys(mods).sort();

  for (const modId of modIds) {
    const mod = mods[modId];
    const configEntries = Object.entries(mod.configuration_options);

    if (configEntries.length === 0) {
      lines.push(`  ["${modId}"]={ configuration_options={  }, enabled=${mod.enabled} },`);
    } else {
      lines.push(`  ["${modId}"]={`);
      lines.push(`    configuration_options={`);
      for (const [key, val] of configEntries) {
        if (!key) continue;
        const formattedKey = /\s/.test(key) ? `["${key}"]` : key;
        if (typeof val === 'string') {
          lines.push(`      ${formattedKey}="${val}",`);
        } else {
          lines.push(`      ${formattedKey}=${val},`);
        }
      }
      lines.push(`    },`);
      lines.push(`    enabled=${mod.enabled}`);
      lines.push(`  },`);
    }
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}
