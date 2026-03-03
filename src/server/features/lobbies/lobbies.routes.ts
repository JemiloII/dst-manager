import { Hono } from 'hono';
import { DSTLobbyClient, Regions } from './lobby-client.service.js';

const lobbiesRoutes = new Hono();
const lobbyClient = new DSTLobbyClient();

// Get all regions
lobbiesRoutes.get('/regions', async (c) => {
  try {
    const regions = await lobbyClient.getCapableRegions();
    return c.json({ regions });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get servers from a specific region
lobbiesRoutes.get('/servers/:region', async (c) => {
  const region = c.req.param('region') as keyof typeof Regions;
  
  if (!Object.values(Regions).includes(region as any)) {
    return c.json({ error: 'Invalid region' }, 400);
  }
  
  try {
    const servers = await lobbyClient.getLobbyServers(region as any);
    return c.json({ 
      region,
      count: servers.length,
      servers: servers.slice(0, 100) // Limit response size
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Search for servers by IP
lobbiesRoutes.get('/search/ip/:ip?', async (c) => {
  let ip = c.req.param('ip');
  
  // If no IP provided, get external IP
  if (!ip) {
    ip = process.env.EXTERNAL_IP;
    if (!ip) {
      try {
        const response = await fetch('https://api.ipify.org?format=text');
        ip = await response.text();
      } catch {
        return c.json({ error: 'IP required or set EXTERNAL_IP environment variable' }, 400);
      }
    }
  }
  
  const region = (c.req.query('region') || Regions.US_EAST_1) as any;
  
  try {
    const servers = await lobbyClient.getLobbyServers(region);
    const filtered = servers.filter(server => {
      if (!server.__addr) return false;
      const [serverIp] = server.__addr.split(':');
      return serverIp === ip;
    });
    
    return c.json({
      ip,
      region,
      found: filtered.length,
      servers: filtered
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Search for servers by name
lobbiesRoutes.get('/search/name/:query', async (c) => {
  const query = c.req.param('query');
  const region = (c.req.query('region') || Regions.US_EAST_1) as any;
  
  try {
    const servers = await lobbyClient.searchServers(query, region);
    return c.json({
      query,
      region,
      found: servers.length,
      servers: servers
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Check if our servers are visible
lobbiesRoutes.get('/check-visibility', async (c) => {
  // Get external IP dynamically if not provided
  let externalIp = process.env.EXTERNAL_IP;
  if (!externalIp) {
    try {
      const response = await fetch('https://api.ipify.org?format=text');
      externalIp = await response.text();
    } catch {
      return c.json({ error: 'Could not determine external IP. Please set EXTERNAL_IP environment variable.' }, 500);
    }
  }
  
  const checkAllRegions = c.req.query('all') === 'true';
  
  const results: any = {
    timestamp: new Date().toISOString(),
    regions: {}
  };
  
  // Default to us-east-1 unless all regions requested
  const regionsToCheck = checkAllRegions 
    ? Object.entries(Regions)
    : [['US_EAST_1', Regions.US_EAST_1]];
  
  for (const [key, region] of regionsToCheck) {
    try {
      const servers = await lobbyClient.getLobbyServers(region as any);
      const ourServers = servers.filter(server => {
        if (!server.__addr) return false;
        const [ip] = server.__addr.split(':');
        return ip === externalIp;
      });
      
      results.regions[region] = {
        totalServers: servers.length,
        ourServers: ourServers.length,
        servers: ourServers.map(s => ({
          name: s.name,
          address: s.__addr,
          players: `${s.connected}/${s.maxconnections}`,
          mode: s.mode,
          password: s.password,
          dedicated: s.dedicated,
          rowId: s.__rowId
        }))
      };
    } catch (error: any) {
      results.regions[region] = {
        error: error.message
      };
    }
  }
  
  results.summary = {
    externalIp,
    visibleServers: Object.values(results.regions).reduce((sum: number, r: any) => 
      sum + (r.ourServers || 0), 0),
    checkedRegions: Object.keys(results.regions).length,
    defaultRegion: checkAllRegions ? null : 'us-east-1'
  };
  
  return c.json(results);
});

export { lobbiesRoutes };