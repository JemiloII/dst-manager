import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { LuaFactory } from 'wasmoon';
import unzipper from 'unzipper';
import { getClusterPath } from '../../services/dst';
import { parseModOverrides } from '../../services/lua';
import { ModConfig, WorkshopSearchResult } from './mods.types';
import Mods from './mods.queries';

const execAsync = promisify(exec);
const { DST_WORKSHOP_DIR = '' } = process.env;

// Detect if text contains Chinese characters
function containsChinese(text: string): boolean {
  // Unicode ranges for Chinese characters
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

// Translate text using Google Translate (free, no limits)
async function translateText(text: string): Promise<string> {
  if (!text || !containsChinese(text)) return text;
  
  try {
    // Google Translate free endpoint (unofficial but widely used)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      // Google returns nested array structure: [[["translated", "original", ...]]]
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0];
      }
    }
  } catch (error) {
    // If translation fails, just return original text
    console.error('Translation failed:', error);
  }
  
  return text;
}

async function batchGetDetails(workshopIds: string[]): Promise<Record<string, WorkshopSearchResult>> {
  if (workshopIds.length === 0) return {};

  const body = workshopIds
    .map((id, i) => `publishedfileids[${i}]=${id}`)
    .join('&');

  const response = await fetch(
    'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `itemcount=${workshopIds.length}&${body}`
    }
  );

  if (!response.ok) return {};

  const data = await response.json();
  const details = data.response?.publishedfiledetails || [];
  const map: Record<string, WorkshopSearchResult> = {};
  for (const d of details) {
    if (d.publishedfileid) {
      map[d.publishedfileid] = {
        workshopId: d.publishedfileid,
        title: d.title || `Workshop-${d.publishedfileid}`,
        description: (d.description || '').slice(0, 200),
        previewUrl: d.preview_url || ''
      };
    }
  }
  return map;
}

export async function searchWorkshop(query: string): Promise<WorkshopSearchResult[]> {
  const response = await fetch(
    `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?key=&search_text=${encodeURIComponent(query)}&appid=322330&return_metadata=true&numperpage=20&query_type=1`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const scrapeResponse = await fetch(
      `https://steamcommunity.com/workshop/browse/?appid=322330&searchtext=${encodeURIComponent(query)}&browsesort=textsearch`
    );
    const html = await scrapeResponse.text();

    const scraped: { workshopId: string; title: string }[] = [];
    const itemPattern = /data-publishedfileid="(\d+)"[\s\S]*?<div class="workshopItemTitle ellipsis">([^<]+)<\/div>/g;
    let match;
    while ((match = itemPattern.exec(html)) !== null) {
      scraped.push({ workshopId: match[1], title: match[2].trim() });
    }

    // Batch fetch details to get preview URLs
    const detailsMap = await batchGetDetails(scraped.map(s => s.workshopId));

    return scraped.map(s => detailsMap[s.workshopId] || {
      workshopId: s.workshopId,
      title: s.title,
      description: '',
      previewUrl: '',
    });
  }

  const data = await response.json();
  const files = data.response?.publishedfiledetails || [];
  return files.map((f: Record<string, unknown>) => ({
    workshopId: f.publishedfileid as string,
    title: f.title as string,
    description: (f.file_description as string || '').slice(0, 200),
    previewUrl: f.preview_url as string || '',
  }));
}

export async function getWorkshopDetails(workshopId: string): Promise<WorkshopSearchResult> {
  const map = await batchGetDetails([workshopId]);
  return map[workshopId] || {
    workshopId,
    title: `Workshop-${workshopId}`,
    description: '',
    previewUrl: ''
  };
}

export async function getModConfig(workshopId: string): Promise<ModConfig> {
  const modId = workshopId.replace('workshop-', '');
  const modPath = path.join(DST_WORKSHOP_DIR, modId);
  
  let modinfoContent: string | null = null;
  
  try {
    // First try to read modinfo.lua directly
    const modinfoPath = path.join(modPath, 'modinfo.lua');
    try {
      modinfoContent = await fs.readFile(modinfoPath, 'utf-8');
    } catch {
      // If modinfo.lua doesn't exist, look for .bin file (which is a zip)
      const files = await fs.readdir(modPath);
      const binFile = files.find(f => f.endsWith('.bin'));
      
      if (binFile) {
        const binPath = path.join(modPath, binFile);
        const directory = await unzipper.Open.file(binPath);
        const modinfoFile = directory.files.find(f => f.path === 'modinfo.lua');
        
        if (modinfoFile) {
          const buffer = await modinfoFile.buffer();
          modinfoContent = buffer.toString('utf-8');
        }
      }
    }
    
    if (!modinfoContent) {
      return { version: null, configuration_options: {} };
    }
    
    // Use Lua engine to parse the modinfo.lua
    const factory = new LuaFactory();
    const engine = await factory.createEngine();
    
    try {
      await engine.doString(modinfoContent);
      
      // Get version
      const version = engine.global.get('version');
      
      // Get configuration_options
      const configOptionsRaw = engine.global.get('configuration_options');
      const configuration_options: Record<string, any> = {};
      
      if (configOptionsRaw && Array.isArray(configOptionsRaw)) {
        // Process all options and translate Chinese text
        for (const option of configOptionsRaw) {
          if (option && typeof option === 'object' && option.name) {
            // Translate labels and descriptions
            const label = await translateText(option.label || option.name);
            const description = option.description || option.hover || null;
            const translatedDescription = description ? await translateText(description) : null;
            
            const processedOption: any = {
              label,
              description: translatedDescription,
              default: option.default
            };
            
            // Process and translate options array if it exists
            if (option.options && Array.isArray(option.options)) {
              processedOption.options = await Promise.all(
                option.options.map(async (opt: any) => ({
                  data: opt.data,
                  description: await translateText(opt.description || '')
                }))
              );
            }
            
            configuration_options[option.name] = processedOption;
          }
        }
      }
      
      return { 
        version: version || null, 
        configuration_options 
      };
    } finally {
      engine.global.close();
    }
  } catch {
    return { version: null, configuration_options: {} };
  }
}

export async function hasConfigOptions(workshopId: string): Promise<boolean> {
  const modId = workshopId.replace('workshop-', '');
  const modPath = path.join(DST_WORKSHOP_DIR, modId);

  let modinfoContent: string | null = null;

  try {
    try {
      modinfoContent = await fs.readFile(path.join(modPath, 'modinfo.lua'), 'utf-8');
    } catch {
      const files = await fs.readdir(modPath);
      const binFile = files.find(f => f.endsWith('.bin'));
      if (binFile) {
        const directory = await unzipper.Open.file(path.join(modPath, binFile));
        const modinfoFile = directory.files.find(f => f.path === 'modinfo.lua');
        if (modinfoFile) {
          modinfoContent = (await modinfoFile.buffer()).toString('utf-8');
        }
      }
    }
    if (!modinfoContent) return false;
    return /configuration_options\s*=/.test(modinfoContent);
  } catch {
    return false;
  }
}

export async function batchHasConfig(workshopIds: string[]): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    workshopIds.map(async (id) => ({ id, has: await hasConfigOptions(id) }))
  );
  const map: Record<string, boolean> = {};
  for (const r of results) map[r.id] = r.has;
  return map;
}

export async function getServerById(serverId: string) {
  return Mods.getServerById(serverId);
}

export async function getAllServers() {
  return Mods.getAllServers();
}

export async function getServerModOverrides(shareCode: string) {
  const clusterDir = getClusterPath(shareCode);
  const modOverridesPath = path.join(clusterDir, 'Master', 'modoverrides.lua');
  
  try {
    const content = await fs.readFile(modOverridesPath, 'utf-8');
    return parseModOverrides(content);
  } catch {
    return null;
  }
}

export async function saveModOverrides(shareCode: string, content: string) {
  const clusterDir = getClusterPath(shareCode);

  await fs.writeFile(path.join(clusterDir, 'Master', 'modoverrides.lua'), content);
  await fs.writeFile(path.join(clusterDir, 'Caves', 'modoverrides.lua'), content);
}

export async function downloadMods(workshopIds: string[]): Promise<void> {
  if (!workshopIds.length) return;

  // Filter to only mods not already downloaded
  const missing = (await Promise.all(
    workshopIds.map(async (id) => {
      const exists = await fs.access(path.join(DST_WORKSHOP_DIR, id)).then(() => true).catch(() => false);
      return exists ? null : id;
    })
  )).filter(Boolean) as string[];

  if (!missing.length) return;

  // Build steamcmd command — batch all downloads in one call
  const downloads = missing.map((id) => `+workshop_download_item 322330 ${id}`).join(' ');
  const cmd = `steamcmd +login anonymous ${downloads} +quit`;

  try {
    await execAsync(cmd, { timeout: 300000 });
  } catch (e) {
    console.error('Failed to download mods:', e);
  }
}

