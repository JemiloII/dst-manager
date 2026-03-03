import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { dedent } from '@server/utils/strings.js';

const { 
  BASE_PORT = '10000',
  SERVERS_DIR,
  DST_TEMPLATE_DIR,
  ADMIN_KUID = '',
  SERVER_HOST = 'localhost',
  DST_INSTALL_DIR
} = process.env;

// Validate required environment variables
if (!SERVERS_DIR) {
  throw new Error('SERVERS_DIR environment variable is required');
}
if (!DST_TEMPLATE_DIR) {
  throw new Error('DST_TEMPLATE_DIR environment variable is required');
}
if (!DST_INSTALL_DIR) {
  throw new Error('DST_INSTALL_DIR environment variable is required');
}

export function extractKuid(clusterToken: string): string | null {
  // KUID is everything between the ^ markers
  const match = clusterToken.match(/\^([^\^]+)\^/);
  return match ? match[1] : null;
}

export function generateShareCode(): string {
  return crypto.randomBytes(6).toString('base64url').substring(0, 6);
}

export function getPortsForServer(portOffset: number) {
  // Game ports MUST be in range 10998-11018 for LAN visibility (21 ports = 10 servers max)
  // Each server needs 2 consecutive ports (master + caves)
  const gamePortBase = 10998 + (portOffset * 2);
  
  // Shard communication port: Can be any port
  const shardPort = 10888 + portOffset;
  
  // Steam ports: Each server needs 4 ports total (2 for master, 2 for caves)
  // Using the pattern that worked for uc37bt
  const steamPortBase = 27000 + (portOffset * 4);
  
  return {
    masterPort: shardPort,                    // Cluster shard communication (10888, 10889, etc)
    masterServerPort: gamePortBase,           // Master game port (10998, 11000, 11002, etc)
    masterSteamPort: steamPortBase + 1,       // Master Steam query port (27001, 27005, 27009...)
    masterAuthPort: steamPortBase,            // Master Steam auth port (27000, 27004, 27008...)
    cavesServerPort: gamePortBase + 1,        // Caves game port (10999, 11001, 11003, etc)
    cavesSteamPort: steamPortBase + 3,        // Caves Steam query port (27003, 27007, 27011...)
    cavesAuthPort: steamPortBase + 2,         // Caves Steam auth port (27002, 27006, 27010...)
  };
}

export function getClusterPath(kuid: string, shareCode: string): string {
  return path.join(SERVERS_DIR, shareCode);
}

export async function ensureServerFiles(
  server: {
    kuid: string;
    share_code: string;
    cluster_token: string;
    port_offset: number;
    name: string;
    description: string;
    game_mode: string;
    max_players: number;
    pvp: number | boolean;
    password: string;
  }
): Promise<void> {
  const clusterDir = getClusterPath(server.kuid, server.share_code);
  
  // Check if critical files exist
  const filesExist = await Promise.all([
    fs.access(path.join(clusterDir, 'cluster_token.txt')).then(() => true).catch(() => false),
    fs.access(path.join(clusterDir, 'cluster.ini')).then(() => true).catch(() => false),
    fs.access(path.join(clusterDir, 'Master', 'server.ini')).then(() => true).catch(() => false),
    fs.access(path.join(clusterDir, 'Caves', 'server.ini')).then(() => true).catch(() => false),
  ]);
  
  // If any critical file is missing, recreate all config files
  if (filesExist.includes(false)) {
    console.log(`Server ${server.share_code}: Missing config files, recreating...`);
    
    const ports = getPortsForServer(server.port_offset);
    
    // Ensure directories exist
    await fs.mkdir(path.join(clusterDir, 'Master'), { recursive: true });
    await fs.mkdir(path.join(clusterDir, 'Caves'), { recursive: true });
    
    // Create cluster_token.txt
    await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), server.cluster_token.trim());
    
    // Create adminlist.txt
    const adminList = [ADMIN_KUID, server.kuid].filter(Boolean).join('\n') + '\n';
    await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);
    
    // Create cluster.ini
    const desc = server.description ? `${server.description}\n${SERVER_HOST}` : SERVER_HOST;
    const clusterIni = dedent(`
      [GAMEPLAY]
      game_mode = ${server.game_mode}
      max_players = ${server.max_players}
      pvp = ${server.pvp ? 'true' : 'false'}
      pause_when_empty = true

      [NETWORK]
      cluster_name = ${server.name}
      cluster_description = ${desc}
      cluster_password = ${server.password || ''}
      cluster_intention = cooperative
      autosaver_enabled = true
      enable_vote_kick = true

      [MISC]
      console_enabled = true

      [SHARD]
      shard_enabled = true
      bind_ip = 0.0.0.0
      master_ip = 127.0.0.1
      master_port = ${ports.masterPort}
      cluster_key = dst-${server.share_code}-${server.port_offset}
    `);
    await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);
    
    // Create Master/server.ini
    const masterIni = dedent(`
      [NETWORK]
      server_port = ${ports.masterServerPort}

      [SHARD]
      is_master = true

      [STEAM]
      master_server_port = ${ports.masterSteamPort}
      authentication_port = ${ports.masterAuthPort}
    `);
    await fs.writeFile(path.join(clusterDir, 'Master', 'server.ini'), masterIni);
    
    // Create Caves/server.ini
    const cavesIni = dedent(`
      [NETWORK]
      server_port = ${ports.cavesServerPort}

      [SHARD]
      is_master = false
      name = Caves

      [STEAM]
      master_server_port = ${ports.cavesSteamPort}
      authentication_port = ${ports.cavesAuthPort}
    `);
    await fs.writeFile(path.join(clusterDir, 'Caves', 'server.ini'), cavesIni);
    
    // Create leveldataoverride files if missing
    const masterLevelPath = path.join(clusterDir, 'Master', 'leveldataoverride.lua');
    try {
      await fs.access(masterLevelPath);
    } catch {
      const masterLevelData = dedent(`
        return {
          override_enabled = true,
          overrides = {
            -- insert overrides here
          }
        }
      `);
      await fs.writeFile(masterLevelPath, masterLevelData);
    }
    
    const cavesLevelPath = path.join(clusterDir, 'Caves', 'leveldataoverride.lua');
    try {
      await fs.access(cavesLevelPath);
    } catch {
      const cavesLevelData = dedent(`
        return {
          preset = "DST_CAVE",
          override_enabled = true,
          overrides = {
            -- insert overrides here
          }
        }
      `);
      await fs.writeFile(cavesLevelPath, cavesLevelData);
    }
    
    console.log(`Server ${server.share_code}: Config files recreated with ports - Game: ${ports.masterServerPort}/${ports.cavesServerPort}, Steam: ${ports.masterSteamPort}/${ports.cavesSteamPort}`);
  }
}

export async function createDockerServerFiles(
  kuid: string,
  shareCode: string,
  clusterToken: string,
  portOffset: number,
  config: {
    name: string;
    description: string;
    gameMode: string;
    maxPlayers: number;
    pvp: boolean;
    password: string;
  }
) {
  const clusterDir = getClusterPath(kuid, shareCode);
  
  // Create directory structure
  await fs.mkdir(path.join(clusterDir, 'Master'), { recursive: true });
  await fs.mkdir(path.join(clusterDir, 'Caves'), { recursive: true });
  
  // Copy Agreements if template exists
  if (DST_TEMPLATE_DIR) {
    const agreementsSource = path.join(DST_TEMPLATE_DIR, 'Agreements');
    const agreementsDest = path.join(clusterDir, 'Agreements');
    try {
      await fs.cp(agreementsSource, agreementsDest, { recursive: true });
    } catch {
      // Agreements don't exist in template, that's okay
    }
  }

  await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), clusterToken.trim());

  const adminList = [ADMIN_KUID, kuid].filter(Boolean).join('\n') + '\n';
  await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);

  const desc = config.description
    ? `${config.description}\n${SERVER_HOST}`
    : SERVER_HOST;

  // Docker uses standard ports internally - no port offset needed
  const clusterIni = dedent(`
    [GAMEPLAY]
    game_mode = ${config.gameMode}
    max_players = ${config.maxPlayers}
    pvp = ${config.pvp}
    pause_when_empty = true

    [NETWORK]
    cluster_name = ${config.name}
    cluster_description = ${desc}
    cluster_password = ${config.password}
    cluster_intention = cooperative
    autosaver_enabled = true
    enable_vote_kick = true

    [MISC]
    console_enabled = true

    [SHARD]
    shard_enabled = true
    bind_ip = 0.0.0.0
    master_ip = dst-master-${shareCode}
    master_port = 10888
    cluster_key = dst-${shareCode}
  `);

  await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);

  // Master uses standard ports
  const masterIni = dedent(`
    [NETWORK]
    server_port = 10999

    [SHARD]
    is_master = true

    [STEAM]
    master_server_port = 27016
    authentication_port = 8766
  `);

  await fs.writeFile(path.join(clusterDir, 'Master', 'server.ini'), masterIni);

  // Caves uses standard ports
  const cavesIni = dedent(`
    [NETWORK]
    server_port = 11000

    [SHARD]
    is_master = false
    name = Caves

    [STEAM]
    master_server_port = 27017
    authentication_port = 8767
  `);

  await fs.writeFile(path.join(clusterDir, 'Caves', 'server.ini'), cavesIni);

  // Create level data overrides
  const masterLevelData = dedent(`
    return {
      override_enabled = true,
      overrides = {
        -- insert overrides here
      }
    }
  `);
  await fs.writeFile(path.join(clusterDir, 'Master', 'leveldataoverride.lua'), masterLevelData);

  const cavesLevelData = dedent(`
    return {
      preset = "DST_CAVE",
      override_enabled = true,
      overrides = {
        -- insert overrides here
      }
    }
  `);
  await fs.writeFile(path.join(clusterDir, 'Caves', 'leveldataoverride.lua'), cavesLevelData);
}

export async function createServerFiles(
  kuid: string,
  shareCode: string,
  clusterToken: string,
  portOffset: number,
  config: {
    name: string;
    description: string;
    gameMode: string;
    maxPlayers: number;
    pvp: boolean;
    password: string;
  }
) {
  const clusterDir = getClusterPath(kuid, shareCode);
  const ports = getPortsForServer(portOffset);

  // Copy template but exclude config files that we'll generate
  await fs.cp(DST_TEMPLATE_DIR, clusterDir, { 
    recursive: true,
    filter: async (src) => {
      const basename = path.basename(src);
      // Skip config files that we'll generate
      if (basename === 'cluster.ini' || 
          basename === 'cluster_token.txt' || 
          basename === 'server.ini' || 
          basename === 'leveldataoverride.lua') {
        return false;
      }
      return true;
    }
  });

  await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), clusterToken.trim());

  const adminList = [ADMIN_KUID, kuid].filter(Boolean).join('\n') + '\n';
  await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);

  const desc = config.description
    ? `${config.description}\n${SERVER_HOST}`
    : SERVER_HOST;

  const clusterIni = dedent(`
    [GAMEPLAY]
    game_mode = ${config.gameMode}
    max_players = ${config.maxPlayers}
    pvp = ${config.pvp}
    pause_when_empty = true

    [NETWORK]
    cluster_name = ${config.name}
    cluster_description = ${desc}
    cluster_password = ${config.password}
    cluster_intention = cooperative
    autosaver_enabled = true
    enable_vote_kick = true

    [MISC]
    console_enabled = true

    [SHARD]
    shard_enabled = true
    bind_ip = 127.0.0.1
    master_ip = 127.0.0.1
    master_port = ${ports.masterPort}
    cluster_key = dst-${shareCode}-${portOffset}
  `);

  await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);

  const masterIni = dedent(`
    [NETWORK]
    server_port = ${ports.masterServerPort}

    [SHARD]
    is_master = true

    [STEAM]
    master_server_port = ${ports.masterSteamPort}
    authentication_port = ${ports.masterAuthPort}
  `);

  await fs.mkdir(path.join(clusterDir, 'Master'), { recursive: true });
  await fs.writeFile(path.join(clusterDir, 'Master', 'server.ini'), masterIni);

  // Create Master leveldataoverride.lua
  const masterLevelData = dedent(`
    return {
      override_enabled = true,
      overrides = {
        -- insert overrides here
      }
    }
  `);
  await fs.writeFile(path.join(clusterDir, 'Master', 'leveldataoverride.lua'), masterLevelData);

  const cavesIni = dedent(`
    [NETWORK]
    server_port = ${ports.cavesServerPort}

    [SHARD]
    is_master = false
    name = Caves

    [STEAM]
    master_server_port = ${ports.cavesSteamPort}
    authentication_port = ${ports.cavesAuthPort}
  `);

  await fs.mkdir(path.join(clusterDir, 'Caves'), { recursive: true });
  await fs.writeFile(path.join(clusterDir, 'Caves', 'server.ini'), cavesIni);

  // Create Caves leveldataoverride.lua
  const cavesLevelData = dedent(`
    return {
      preset = "DST_CAVE",
      override_enabled = true,
      overrides = {
        -- insert overrides here
      }
    }
  `);
  await fs.writeFile(path.join(clusterDir, 'Caves', 'leveldataoverride.lua'), cavesLevelData);
}

export async function updateClusterIni(
  kuid: string,
  shareCode: string,
  portOffset: number,
  config: {
    name: string;
    description: string;
    gameMode: string;
    maxPlayers: number;
    pvp: boolean;
    password: string;
  }
) {
  const clusterDir = getClusterPath(kuid, shareCode);
  const ports = getPortsForServer(portOffset);

  const desc = config.description
    ? `${config.description}\n${SERVER_HOST}`
    : SERVER_HOST;

  const clusterIni = dedent(`
    [GAMEPLAY]
    game_mode = ${config.gameMode}
    max_players = ${config.maxPlayers}
    pvp = ${config.pvp}
    pause_when_empty = true

    [NETWORK]
    cluster_name = ${config.name}
    cluster_description = ${desc}
    cluster_password = ${config.password}
    cluster_intention = cooperative
    autosaver_enabled = true
    enable_vote_kick = true

    [MISC]
    console_enabled = true

    [SHARD]
    shard_enabled = true
    bind_ip = 127.0.0.1
    master_ip = 127.0.0.1
    master_port = ${ports.masterPort}
    cluster_key = dst-${shareCode}-${portOffset}
  `);

  await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);
}

export async function updateModsSetup(workshopIds: string[]) {
  const modsDir = path.join(DST_INSTALL_DIR, 'mods');
  const lines = workshopIds.map((id) => `ServerModSetup("${id}")`);
  const content = lines.join('\n') + '\n';
  await fs.writeFile(path.join(modsDir, 'dedicated_server_mods_setup.lua'), content);
}
