import fs from 'fs/promises';
import path from 'path';
import { env } from '../env.js';

export function extractKuid(clusterToken: string): string | null {
  // KUID is everything between the ^ markers
  const match = clusterToken.match(/\^([^\^]+)\^/);
  return match ? match[1] : null;
}

export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getPortsForServer(portOffset: number) {
  const base = env.BASE_PORT + portOffset * 7;
  return {
    masterPort: base,
    masterServerPort: base + 1,
    masterSteamPort: base + 2,
    masterAuthPort: base + 3,
    cavesServerPort: base + 4,
    cavesSteamPort: base + 5,
    cavesAuthPort: base + 6,
  };
}

export function getClusterPath(kuid: string, shareCode: string): string {
  return path.join(env.SERVERS_DIR, shareCode);
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

  await fs.cp(env.DST_TEMPLATE_DIR, clusterDir, { recursive: true });

  await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), clusterToken.trim());

  const adminList = [env.ADMIN_KUID, kuid].filter(Boolean).join('\n') + '\n';
  await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);

  const desc = config.description
    ? `${config.description}\n${env.SERVER_HOST}`
    : env.SERVER_HOST;

  const clusterIni = `
[GAMEPLAY]
game_mode = ${config.gameMode}
max_players = ${config.maxPlayers}
pvp = ${config.pvp}
pause_when_empty = true

[NETWORK]
cluster_description = ${desc}
cluster_name = ${config.name}
cluster_password = ${config.password}

[MISC]
console_enabled = true

[SHARD]
shard_enabled = true
bind_ip = 127.0.0.1
master_ip = 127.0.0.1
master_port = ${ports.masterPort}
cluster_key = dst-manager-${shareCode}
`.trim() + '\n';

  await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);

  const masterIni = `
[NETWORK]
server_port = ${ports.masterServerPort}

[SHARD]
is_master = true

[STEAM]
master_server_port = ${ports.masterSteamPort}
authentication_port = ${ports.masterAuthPort}
`.trim() + '\n';

  await fs.mkdir(path.join(clusterDir, 'Master'), { recursive: true });
  await fs.writeFile(path.join(clusterDir, 'Master', 'server.ini'), masterIni);

  const cavesIni = `
[NETWORK]
server_port = ${ports.cavesServerPort}

[SHARD]
is_master = false
name = Caves

[STEAM]
master_server_port = ${ports.cavesSteamPort}
authentication_port = ${ports.cavesAuthPort}
`.trim() + '\n';

  await fs.mkdir(path.join(clusterDir, 'Caves'), { recursive: true });
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
    ? `${config.description}\n${env.SERVER_HOST}`
    : env.SERVER_HOST;

  const clusterIni = `
[GAMEPLAY]
game_mode = ${config.gameMode}
max_players = ${config.maxPlayers}
pvp = ${config.pvp}
pause_when_empty = true

[NETWORK]
cluster_description = ${desc}
cluster_name = ${config.name}
cluster_password = ${config.password}

[MISC]
console_enabled = true

[SHARD]
shard_enabled = true
bind_ip = 127.0.0.1
master_ip = 127.0.0.1
master_port = ${ports.masterPort}
cluster_key = dst-manager-${shareCode}
`.trim() + '\n';

  await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);
}

export async function updateModsSetup(workshopIds: string[]) {
  const modsDir = path.join(env.DST_INSTALL_DIR, 'mods');
  const lines = workshopIds.map((id) => `ServerModSetup("${id}")`);
  const content = lines.join('\n') + '\n';
  await fs.writeFile(path.join(modsDir, 'dedicated_server_mods_setup.lua'), content);
}
// Test HMR
