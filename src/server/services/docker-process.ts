import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { dedent } from '@server/utils/strings.js';
import Servers from '../features/servers/servers.queries.js';

const execAsync = promisify(exec);

const { SERVERS_DIR } = process.env;

interface DockerContainer {
  id: string;
  name: string;
  status: string;
}

export class DockerProcessService {
  // Get unique host ports for a server based on port offset
  private getHostPorts(portOffset: number) {
    const gamePortBase = 10998 + (portOffset * 2);
    const steamPortBase = 27000 + (portOffset * 4);  // Need 4 Steam ports per server
    
    return {
      masterGamePort: gamePortBase,
      cavesGamePort: gamePortBase + 1,
      masterSteamPort: steamPortBase + 1,
      cavesSteamPort: steamPortBase + 3,
      masterAuthPort: steamPortBase,  
      cavesAuthPort: steamPortBase + 2,
    };
  }

  async startServer(serverId: number, shareCode: string, portOffset: number): Promise<{ success: boolean; message: string }> {
    const clusterDir = path.join(SERVERS_DIR!, shareCode);
    
    try {
      // Check if containers are already running
      const status = await this.getServerStatus(shareCode);
      if (status.running) {
        return { 
          success: true, 
          message: 'Server already running' 
        };
      }

      // Ensure docker-compose.yml exists
      const composeFile = path.join(clusterDir, 'docker-compose.yml');
      try {
        await fs.access(composeFile);
      } catch {
        // Create docker-compose.yml if it doesn't exist
        await this.createDockerCompose(shareCode, portOffset, clusterDir);
      }

      // Start containers using docker-compose
      const { stdout, stderr } = await execAsync('docker-compose up -d', {
        cwd: clusterDir
      });

      // Update database status
      await Servers.updateStatus(serverId, 'running');
      
      return { 
        success: true, 
        message: `Started Docker containers for ${shareCode}` 
      };
    } catch (error: any) {
      console.error(`Failed to start Docker server ${shareCode}:`, error);
      return { 
        success: false, 
        message: error.message 
      };
    }
  }

  async stopServer(serverId: number, shareCode: string): Promise<{ success: boolean; message: string }> {
    const clusterDir = path.join(SERVERS_DIR!, shareCode);
    
    try {
      // Stop containers using docker-compose
      const { stdout, stderr } = await execAsync('docker-compose down', {
        cwd: clusterDir
      });

      // Update database status
      await Servers.updateStatus(serverId, 'stopped');
      
      return { 
        success: true, 
        message: `Stopped Docker containers for ${shareCode}` 
      };
    } catch (error: any) {
      console.error(`Failed to stop Docker server ${shareCode}:`, error);
      return { 
        success: false, 
        message: error.message 
      };
    }
  }

  async getServerStatus(shareCode: string): Promise<{ 
    running: boolean; 
    masterContainer?: string;
    cavesContainer?: string;
  }> {
    try {
      const { stdout } = await execAsync(
        `docker ps --filter "name=dst-${shareCode}" --format "{{.Names}}:{{.Status}}"`
      );
      
      const containers = stdout.trim().split('\n').filter(Boolean);
      const runningContainers: Record<string, string> = {};
      
      for (const line of containers) {
        const [name, status] = line.split(':');
        if (name && status && status.includes('Up')) {
          runningContainers[name] = status;
        }
      }
      
      // For combined container, both master and caves are in the same container
      const containerName = `dst-${shareCode}`;
      const isRunning = !!runningContainers[containerName];
      
      return {
        running: isRunning,
        masterContainer: isRunning ? runningContainers[containerName] : undefined,
        cavesContainer: isRunning ? runningContainers[containerName] : undefined
      };
    } catch (error) {
      return { running: false };
    }
  }

  async getLogs(shareCode: string, shard: 'master' | 'caves', lines: number = 100): Promise<string> {
    try {
      // Combined container
      const containerName = `dst-${shareCode}`;
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${containerName}`);
      return stdout;
    } catch (error: any) {
      return `Failed to get logs: ${error.message}`;
    }
  }

  async restartServer(serverId: number, shareCode: string): Promise<{ success: boolean; message: string }> {
    const clusterDir = path.join(SERVERS_DIR!, shareCode);
    
    try {
      // Restart containers using docker-compose
      const { stdout, stderr } = await execAsync('docker-compose restart', {
        cwd: clusterDir
      });
      
      return { 
        success: true, 
        message: `Restarted Docker containers for ${shareCode}` 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message 
      };
    }
  }

  private async createDockerCompose(shareCode: string, portOffset: number, clusterDir: string): Promise<void> {
    const ports = this.getHostPorts(portOffset);
    const absoluteClusterDir = path.resolve(clusterDir);
    
    const dockerCompose = dedent(`
      services:
        dst-${shareCode}:
          image: dst-server-combined:latest
          container_name: dst-${shareCode}
          volumes:
            - ${absoluteClusterDir}:/data
          ports:
            # Only expose Steam ports - game ports stay internal
            - "${ports.masterAuthPort}:8766/udp"
            - "${ports.masterSteamPort}:27016/udp"
            - "${ports.cavesAuthPort}:8767/udp"
            - "${ports.cavesSteamPort}:27017/udp"
          restart: unless-stopped
    `);
    
    await fs.writeFile(path.join(clusterDir, 'docker-compose.yml'), dockerCompose);
  }

  async checkAllServersOnStartup(): Promise<void> {
    const servers = await Servers.findAll();
    
    for (const server of servers) {
      const status = await this.getServerStatus(server.share_code);
      const newStatus = status.running ? 'running' : 'stopped';
      
      if (server.status !== newStatus) {
        await Servers.updateStatus(server.id, newStatus);
        console.log(`Server ${server.share_code}: status updated to ${newStatus}`);
      }
    }
  }

  async buildDockerImage(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Building DST Docker image...');
      const { stdout, stderr } = await execAsync(
        'docker build -f Dockerfile.dst-simple -t dst-server:latest .',
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer for build output
      );
      
      return { 
        success: true, 
        message: 'Docker image built successfully' 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: `Failed to build Docker image: ${error.message}` 
      };
    }
  }
}

export const dockerProcessService = new DockerProcessService();