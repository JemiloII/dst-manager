import net from 'net';

export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

export async function checkPortRange(basePort: number, count: number = 7): Promise<boolean> {
  for (let i = 0; i < count; i++) {
    const available = await isPortAvailable(basePort + i);
    if (!available) {
      return false;
    }
  }
  return true;
}