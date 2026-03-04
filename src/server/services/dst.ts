import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { renderIniTemplate } from '@server/utils/ini.js';

const DST_TEMPLATE_DIR = './dst';

const {
  BASE_PORT = '10000',
  SERVERS_DIR = './servers',
  ADMIN_KUID = '',
  SERVER_HOST = 'localhost',
  DST_INSTALL_DIR = ''
} = process.env;

if (!SERVERS_DIR) {
  throw new Error('SERVERS_DIR environment variable is required');
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

export function getClusterPath(shareCode: string): string {
  return path.join(SERVERS_DIR, shareCode);
}

interface ServerConfig {
  name: string;
  description: string;
  gameMode: string;
  serverIntention: string;
  maxPlayers: number;
  pvp: boolean;
  password: string;
}

function getClusterIniValues(shareCode: string, portOffset: number, config: ServerConfig) {
  const desc = config.description
    ? `${config.description}\n${SERVER_HOST}`
    : SERVER_HOST;
  const ports = getPortsForServer(portOffset);

  return {
    GAME_MODE: config.gameMode,
    MAX_PLAYERS: config.maxPlayers,
    PVP: config.pvp,
    CLUSTER_NAME: config.name,
    CLUSTER_DESCRIPTION: desc,
    CLUSTER_PASSWORD: config.password,
    CLUSTER_INTENTION: config.serverIntention,
    ENABLE_VOTE_KICK: true,
    MASTER_PORT: ports.masterPort,
    CLUSTER_KEY: `dst-${shareCode}`,
  };
}

async function writeClusterIni(shareCode: string, portOffset: number, config: ServerConfig) {
  const clusterDir = getClusterPath(shareCode);
  const values = getClusterIniValues(shareCode, portOffset, config);
  const content = await renderIniTemplate(path.join(DST_TEMPLATE_DIR, 'cluster.ini'), values);
  await fs.writeFile(path.join(clusterDir, 'cluster.ini'), content);
}

async function writeServerInis(shareCode: string, portOffset: number) {
  const clusterDir = getClusterPath(shareCode);
  const ports = getPortsForServer(portOffset);

  const masterValues = {
    SERVER_PORT: ports.masterServerPort,
    MASTER_SERVER_PORT: ports.masterSteamPort,
    AUTH_PORT: ports.masterAuthPort,
  };

  const cavesValues = {
    SERVER_PORT: ports.cavesServerPort,
    MASTER_SERVER_PORT: ports.cavesSteamPort,
    AUTH_PORT: ports.cavesAuthPort,
  };

  const [masterIni, cavesIni] = await Promise.all([
    renderIniTemplate(path.join(DST_TEMPLATE_DIR, 'Master', 'server.ini'), masterValues),
    renderIniTemplate(path.join(DST_TEMPLATE_DIR, 'Caves', 'server.ini'), cavesValues),
  ]);

  await Promise.all([
    fs.writeFile(path.join(clusterDir, 'Master', 'server.ini'), masterIni),
    fs.writeFile(path.join(clusterDir, 'Caves', 'server.ini'), cavesIni),
  ]);
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
    server_intention: string;
    max_players: number;
    pvp: number | boolean;
    password: string;
  }
): Promise<void> {
  const clusterDir = getClusterPath(server.share_code);

  await fs.mkdir(path.join(clusterDir, 'Master'), { recursive: true });
  await fs.mkdir(path.join(clusterDir, 'Caves'), { recursive: true });

  await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), server.cluster_token.trim());

  const adminList = [ADMIN_KUID, server.kuid].filter(Boolean).join('\n') + '\n';
  await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);

  const config: ServerConfig = {
    name: server.name,
    description: server.description,
    gameMode: server.game_mode,
    serverIntention: server.server_intention || 'cooperative',
    maxPlayers: server.max_players,
    pvp: !!server.pvp,
    password: server.password || '',
  };

  await writeClusterIni(server.share_code, server.port_offset, config);
  await writeServerInis(server.share_code, server.port_offset);

  const templateFiles = [
    { src: path.join(DST_TEMPLATE_DIR, 'Master', 'leveldataoverride.lua'), dest: path.join(clusterDir, 'Master', 'leveldataoverride.lua') },
    { src: path.join(DST_TEMPLATE_DIR, 'Caves', 'leveldataoverride.lua'), dest: path.join(clusterDir, 'Caves', 'leveldataoverride.lua') },
    { src: path.join(DST_TEMPLATE_DIR, 'Master', 'modoverrides.lua'), dest: path.join(clusterDir, 'Master', 'modoverrides.lua') },
    { src: path.join(DST_TEMPLATE_DIR, 'Caves', 'modoverrides.lua'), dest: path.join(clusterDir, 'Caves', 'modoverrides.lua') },
  ];

  for (const { src, dest } of templateFiles) {
    const exists = await fs.access(dest).then(() => true).catch(() => false);
    if (!exists) {
      await fs.cp(src, dest).catch(() => {});
    }
  }
}

export async function createServerFiles(
  kuid: string,
  shareCode: string,
  clusterToken: string,
  portOffset: number,
  config: ServerConfig
) {
  const clusterDir = getClusterPath(shareCode);

  await fs.cp(DST_TEMPLATE_DIR, clusterDir, { recursive: true });

  await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), clusterToken.trim());

  const adminList = [ADMIN_KUID, kuid].filter(Boolean).join('\n') + '\n';
  await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);

  await writeClusterIni(shareCode, portOffset, config);
  await writeServerInis(shareCode, portOffset);
}

export async function updateClusterIni(
  shareCode: string,
  portOffset: number,
  config: ServerConfig
) {
  await writeClusterIni(shareCode, portOffset, config);
}

export async function updateModsSetup(workshopIds: string[]) {
  const modsDir = path.join(DST_INSTALL_DIR, 'mods');
  const lines = workshopIds.map((id) => `ServerModSetup("${id}")`);
  const content = lines.join('\n') + '\n';
  await fs.writeFile(path.join(modsDir, 'dedicated_server_mods_setup.lua'), content);
}
