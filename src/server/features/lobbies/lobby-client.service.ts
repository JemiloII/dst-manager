import axios from 'axios';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

// Constants
const GAME_ID = 'DontStarveTogether';

export enum Platform {
  Steam = 1,
  PSN = 2,
  Rail = 4, // WeGame
  XBOne = 16,
  PS4Official = 19,
  Switch = 32,
}

export const Regions = {
  US_EAST_1: 'us-east-1',
  EU_CENTRAL_1: 'eu-central-1',
  AP_SOUTHEAST_1: 'ap-southeast-1',
  AP_EAST_1: 'ap-east-1',
} as const;

export type Region = typeof Regions[keyof typeof Regions];

// URLs
const LOBBY_REGION_URL = 'https://lobby-v2-cdn.klei.com/regioncapabilities-v2.json';
const LOBBY_SERVERS_URL = (region: string, platform: string) => 
  `https://lobby-v2-cdn.klei.com/${region}-${platform}.json.gz`;
const LOBBY_DETAILS_URL = (region: string) => 
  `https://lobby-v2-${region}.klei.com/lobby/read`;

// Types
export interface Server {
  // Network options
  guid: string;
  __rowId: string;
  steamid?: string;
  steamclanid?: string;
  ownernetid?: string;
  steamroom?: string;
  session: string;
  __addr: string;
  port: number;
  host: string;
  platform: Platform;

  // Server settings
  clanonly: boolean;
  lanonly: boolean;

  // Game options
  name: string;
  mode: string;
  intent: string;
  season: string;
  tags?: string;
  v: number;
  maxconnections: number;
  connected: number;

  // Server features
  mods: boolean;
  pvp: boolean;
  password: boolean;
  dedicated: boolean;
  clienthosted: boolean;
  allownewplayers: boolean;
  serverpaused: boolean;
  fo: boolean; // friends only

  // Processed
  region?: string;
  tag_arr?: string[];
}

export interface ServerList {
  GET: Server[];
}

export interface ServerDetails extends Server {
  tick: number;
  clientmodsoff: boolean;
  nat: number;
  players?: Player[];
  mods_info?: Mod[];
  secondaries?: Record<string, Secondary>;
}

export interface Player {
  name: string;
  prefab: string;
  steamId: string;
  colour: string;
  level: number;
}

export interface Mod {
  id: string;
  name: string;
  version1: string;
  version2: string;
  enabled: boolean;
}

export interface Secondary {
  id: string;
  steamid: string;
  __addr: string;
  port: number;
}

export interface RegionCapabilities {
  LobbyRegions: Array<{
    Region: string;
  }>;
}

export class DSTLobbyClient {
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  /**
   * Get available regions
   */
  async getCapableRegions(): Promise<string[]> {
    try {
      const response = await axios.get<RegionCapabilities>(LOBBY_REGION_URL);
      return response.data.LobbyRegions.map(r => r.Region);
    } catch (error: any) {
      throw new Error(`Failed to get regions: ${error.message}`);
    }
  }

  /**
   * Get lobby servers for a specific region and platform
   */
  async getLobbyServers(region: Region, platform: Platform = Platform.Steam): Promise<Server[]> {
    try {
      const url = LOBBY_SERVERS_URL(region, Platform[platform]);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        decompress: true, // Let axios handle decompression
        headers: {
          'Accept-Encoding': 'gzip',
        }
      });

      // Try to parse directly first (axios might have already decompressed)
      let data: ServerList;
      try {
        data = JSON.parse(response.data.toString()) as ServerList;
      } catch {
        // If that fails, try manual decompression
        const decompressed = await gunzip(response.data);
        data = JSON.parse(decompressed.toString()) as ServerList;
      }

      // Process servers
      return data.GET.map(server => ({
        ...server,
        region,
        tag_arr: server.tags ? server.tags.split(',') : [],
      }));
    } catch (error: any) {
      throw new Error(`Failed to get servers: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(region: Region, rowId: string): Promise<ServerDetails> {
    if (!this.token) {
      throw new Error('Klei token is required for getting server details');
    }

    try {
      const url = LOBBY_DETAILS_URL(region);
      const body = {
        __token: this.token,
        __gameId: GAME_ID,
        query: {
          __rowId: rowId,
        },
      };

      const response = await axios.post<{ GET: ServerDetails[] }>(url, body);
      
      if (response.data.GET && response.data.GET.length > 0) {
        return response.data.GET[0];
      }
      
      throw new Error('Server not found');
    } catch (error: any) {
      throw new Error(`Failed to get server details: ${error.message}`);
    }
  }

  /**
   * Search for servers by name or owner
   */
  async searchServers(query: string, region: Region = Regions.US_EAST_1): Promise<Server[]> {
    const servers = await this.getLobbyServers(region);
    const lowercaseQuery = query.toLowerCase();
    
    return servers.filter(server => 
      server.name.toLowerCase().includes(lowercaseQuery) ||
      server.host?.toLowerCase().includes(lowercaseQuery) ||
      server.ownernetid?.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Find servers by IP and port range
   */
  async findServersByHost(ip: string, minPort: number, maxPort: number, region: Region = Regions.US_EAST_1): Promise<Server[]> {
    const servers = await this.getLobbyServers(region);
    
    return servers.filter(server => {
      const addr = server.__addr;
      if (!addr) return false;
      
      const [serverIp, serverPortStr] = addr.split(':');
      const serverPort = parseInt(serverPortStr || '0');
      
      return serverIp === ip && serverPort >= minPort && serverPort <= maxPort;
    });
  }
}