import net from 'net';

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

export async function checkPorts(ports: number[]): Promise<number[]> {
  const results = await Promise.all(
    ports.map(async (port) => ({ port, available: await isPortAvailable(port) }))
  );
  return results.filter((r) => !r.available).map((r) => r.port);
}
