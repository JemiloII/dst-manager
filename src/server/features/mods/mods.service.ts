import fs from 'fs/promises';
import path from 'path';
import { LuaFactory } from 'wasmoon';
import unzipper from 'unzipper';
import { getClusterPath } from '../../services/dst';
import { parseModOverrides } from '../../services/lua';
import { ModConfig, WorkshopSearchResult } from './mods.types';
import Mods from './mods.queries';

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

    const results: WorkshopSearchResult[] = [];
    const itemPattern = /data-publishedfileid="(\d+)"[\s\S]*?<div class="workshopItemTitle ellipsis">([^<]+)<\/div>/g;
    let match;
    while ((match = itemPattern.exec(html)) !== null) {
      results.push({
        workshopId: match[1],
        title: match[2].trim(),
        description: '',
        previewUrl: '',
      });
    }
    return results;
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
  try {
    const response = await fetch(
      `https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `itemcount=1&publishedfileids[0]=${workshopId}`
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const details = data.response?.publishedfiledetails?.[0];
      if (details) {
        return {
          workshopId: details.publishedfileid,
          title: details.title || `Workshop-${workshopId}`,
          description: details.description || '',
          previewUrl: details.preview_url || ''
        };
      }
    }
  } catch {}
  
  return {
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