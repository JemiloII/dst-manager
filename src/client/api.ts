const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return null;
    }

    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    token = await refreshAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
  }

  return res;
}

export const api = {
  get: (path: string) => apiFetch(path),
  post: (path: string, body?: unknown) =>
    apiFetch(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) =>
    apiFetch(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => apiFetch(path, { method: 'DELETE' }),
};

export interface SSEConnection {
  addEventListener(event: string, handler: (e: { data: string }) => void): void;
  close(): void;
  onerror: ((err: unknown) => void) | null;
}

export function createSSE(path: string): SSEConnection {
  const listeners = new Map<string, Array<(e: { data: string }) => void>>();
  const controller = new AbortController();
  let onerror: ((err: unknown) => void) | null = null;

  const connect = async () => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}${path}`, { headers, signal: controller.signal });
      if (!res.ok || !res.body) {
        onerror?.(new Error(`SSE connect failed: ${res.status}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            const handlers = listeners.get(eventType);
            if (handlers) handlers.forEach((h) => h({ data }));
            eventType = 'message';
          } else if (line === '') {
            eventType = 'message';
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) onerror?.(err);
    }
  };

  connect();

  return {
    addEventListener(event: string, handler: (e: { data: string }) => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
    },
    close() { controller.abort(); },
    set onerror(fn: ((err: unknown) => void) | null) { onerror = fn; },
    get onerror() { return onerror; },
  };
}
