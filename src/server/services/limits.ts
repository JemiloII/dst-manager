import Servers from '@server/features/servers/servers.queries.js';
import Auth from '@server/features/auth/auth.queries.js';

interface Limits {
  maxServers: number;
  maxRunning: number;
}

const LIMITS = {
  unvalidated: { maxServers: 2, maxRunning: 1 },
  validated: { maxServers: 5, maxRunning: 3 },
  admin: { maxServers: Infinity, maxRunning: Infinity },
} as const;

export function getLimitsForUser(role: string, isValidated: boolean): Limits {
  if (role === 'admin') return LIMITS.admin;
  return isValidated ? LIMITS.validated : LIMITS.unvalidated;
}

export async function checkCanCreateServer(userId: number): Promise<{ allowed: boolean; reason?: string }> {
  const user = await Auth.findUserById(userId);
  if (!user) return { allowed: false, reason: 'User not found' };

  if (user.role === 'admin') return { allowed: true };

  if (!user.kuid) {
    return { allowed: false, reason: 'You must register a KUID before creating servers. Visit your account settings.' };
  }

  const limits = getLimitsForUser(user.role, !!user.is_validated);
  const ownedCount = await Servers.countOwnedServers(userId);

  if (ownedCount >= limits.maxServers) {
    const tip = user.is_validated ? '' : ' Validate your account for higher limits.';
    return { allowed: false, reason: `Server limit reached (${ownedCount}/${limits.maxServers}).${tip}` };
  }

  return { allowed: true };
}

export async function checkCanStartServer(userId: number): Promise<{ allowed: boolean; reason?: string }> {
  const user = await Auth.findUserById(userId);
  if (!user) return { allowed: false, reason: 'User not found' };

  if (user.role === 'admin') return { allowed: true };

  const limits = getLimitsForUser(user.role, !!user.is_validated);
  const runningCount = await Servers.countRunningOwnedServers(userId);

  if (runningCount >= limits.maxRunning) {
    const tip = user.is_validated ? '' : ' Validate your account for higher limits.';
    return { allowed: false, reason: `Running server limit reached (${runningCount}/${limits.maxRunning}).${tip}` };
  }

  return { allowed: true };
}
