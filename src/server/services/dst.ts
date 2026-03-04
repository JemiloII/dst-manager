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
  const gamePortBase = 10998 + (portOffset * 2);
  const shardPort = 10888 + portOffset;
  const steamBase = 27016 + (portOffset * 2);
  const authBase = 8766 + (portOffset * 2);

  return {
    masterPort: shardPort,
    masterServerPort: gamePortBase,
    masterSteamPort: steamBase,
    masterAuthPort: authBase,
    cavesServerPort: gamePortBase + 1,
    cavesSteamPort: steamBase + 1,
    cavesAuthPort: authBase + 1,
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

    console.log(`Server ${server.share_code}: Config files recreated with ports - Game: ${ports.masterServerPort}/${ports.cavesServerPort}, Steam: ${ports.masterSteamPort}/${ports.cavesSteamPort}`);
  }
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

  await fs.cp(DST_TEMPLATE_DIR, clusterDir, { recursive: true });

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

  await fs.writeFile(path.join(clusterDir, 'Master', 'server.ini'), masterIni);

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
