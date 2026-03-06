export function formatRuntime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${Math.max(1, minutes)}m`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
