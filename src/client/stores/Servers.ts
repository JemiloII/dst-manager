import { create } from 'zustand';
import { api } from '../api';

interface Server {
  id: number;
  user_id: number;
  name: string;
  description: string;
  cluster_token: string;
  kuid: string;
  share_code: string;
  max_players: number;
  game_mode: string;
  pvp: number;
  password: string;
  port_offset: number;
  status: 'stopped' | 'starting' | 'running' | 'paused';
  created_at: string;
}

interface PlayerInfo {
  count: number;
  max: number;
  list: string[];
}

interface ServerState {
  servers: Server[];
  players: Record<number, PlayerInfo>;
  loading: boolean;
  fetchServers: () => Promise<void>;
  updateStatus: (id: number, status: Server['status']) => void;
  updatePlayers: (id: number, players: PlayerInfo) => void;
}

export const useServers = create<ServerState>((set) => ({
  servers: [],
  players: {},
  loading: false,

  fetchServers: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/servers');
      const data = await res.json();
      set({ servers: Array.isArray(data) ? data : [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateStatus: (id, status) => {
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, status } : s)),
    }));
  },

  updatePlayers: (id, players) => {
    set((state) => ({
      players: { ...state.players, [id]: players },
    }));
  },
}));
