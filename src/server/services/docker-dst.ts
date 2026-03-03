import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { dedent } from '@server/utils/strings.js';

const execAsync = promisify(exec);

const { 
  SERVERS_DIR,
  DST_TEMPLATE_DIR,
  ADMIN_KUID = '',
  SERVER_HOST = 'localhost',
} = process.env;

interface DockerPorts {
  // Host ports that Docker will map to
  hostMasterGamePort: number;
  hostCavesGamePort: number;
  hostMasterSteamPort: number;
  hostCavesSteamPort: number;
  hostMasterAuthPort: number;
  hostCavesAuthPort: number;
}

export function getDockerPortsForServer(portOffset: number): DockerPorts {
  // Host ports - these need to be unique per server
  const gamePortBase = 10998 + (portOffset * 2);
  const steamPortBase = 27000 + (portOffset * 4);
  
  return {
    hostMasterGamePort: gamePortBase,
    hostCavesGamePort: gamePortBase + 1,
    hostMasterSteamPort: steamPortBase,
    hostCavesSteamPort: steamPortBase + 1,
    hostMasterAuthPort: steamPortBase + 2,
    hostCavesAuthPort: steamPortBase + 3,
  };
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
  const clusterDir = path.join(SERVERS_DIR!, shareCode);
  
  // Create directory structure
  await fs.mkdir(path.join(clusterDir, 'Master'), { recursive: true });
  await fs.mkdir(path.join(clusterDir, 'Caves'), { recursive: true });
  await fs.mkdir(path.join(clusterDir, 'Agreements'), { recursive: true });
  
  // Create cluster_token.txt
  await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), clusterToken.trim());
  
  // Create adminlist.txt
  const adminList = [ADMIN_KUID, kuid].filter(Boolean).join('\n') + '\n';
  await fs.writeFile(path.join(clusterDir, 'adminlist.txt'), adminList);
  
  // Create cluster.ini with STANDARD ports (Docker handles mapping)
  const desc = config.description ? `${config.description}\n${SERVER_HOST}` : SERVER_HOST;
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
  
  // Master server.ini - STANDARD PORTS
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
  
  // Caves server.ini - STANDARD PORTS
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
  
  // Create leveldataoverride files
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
  
  // Create docker-compose.yml for this server
  const ports = getDockerPortsForServer(portOffset);
  const dockerCompose = dedent(`
    version: '3.8'

    services:
      dst-master-${shareCode}:
        image: dst-server:latest
        container_name: dst-master-${shareCode}
        environment:
          - SHARD_TYPE=Master
        volumes:
          - ${clusterDir}:/data
        ports:
          - "${ports.hostMasterGamePort}:10999/udp"
          - "${ports.hostMasterSteamPort}:27016/udp"
          - "${ports.hostMasterAuthPort}:8766/udp"
        restart: unless-stopped
        networks:
          - dst-${shareCode}

      dst-caves-${shareCode}:
        image: dst-server:latest
        container_name: dst-caves-${shareCode}
        environment:
          - SHARD_TYPE=Caves
        volumes:
          - ${clusterDir}:/data
        ports:
          - "${ports.hostCavesGamePort}:11000/udp"
          - "${ports.hostCavesSteamPort}:27017/udp"
          - "${ports.hostCavesAuthPort}:8767/udp"
        restart: unless-stopped
        networks:
          - dst-${shareCode}

    networks:
      dst-${shareCode}:
        driver: bridge
  `);
  await fs.writeFile(path.join(clusterDir, 'docker-compose.yml'), dockerCompose);
}

export async function startDockerServer(shareCode: string): Promise<{ success: boolean; message: string }> {
  const clusterDir = path.join(SERVERS_DIR!, shareCode);
  
  try {
    // Start containers using docker-compose
    const { stdout, stderr } = await execAsync(`docker-compose up -d`, {
      cwd: clusterDir
    });
    
    return { 
      success: true, 
      message: `Started Docker containers for ${shareCode}`
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: `Failed to start Docker containers: ${error.message}`
    };
  }
}

export async function stopDockerServer(shareCode: string): Promise<{ success: boolean; message: string }> {
  const clusterDir = path.join(SERVERS_DIR!, shareCode);
  
  try {
    // Stop containers using docker-compose
    const { stdout, stderr } = await execAsync(`docker-compose down`, {
      cwd: clusterDir
    });
    
    return { 
      success: true, 
      message: `Stopped Docker containers for ${shareCode}`
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: `Failed to stop Docker containers: ${error.message}`
    };
  }
}

export async function getDockerServerStatus(shareCode: string): Promise<{ 
  running: boolean; 
  masterContainer?: string;
  cavesContainer?: string;
}> {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=dst-.*-${shareCode}" --format "{{.Names}}"`);
    const containers = stdout.trim().split('\n').filter(Boolean);
    
    const masterContainer = containers.find(c => c.includes('master'));
    const cavesContainer = containers.find(c => c.includes('caves'));
    
    return {
      running: containers.length > 0,
      masterContainer,
      cavesContainer
    };
  } catch (error) {
    return { running: false };
  }
}