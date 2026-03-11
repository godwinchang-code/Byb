import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface RecentSession {
  left: string;
  right: string;
  type: "directory" | "file";
  timestamp: number;
}

interface SessionData {
  recent_sessions: RecentSession[];
}

interface SessionState {
  recentSessions: RecentSession[];
  loaded: boolean;
  load: () => Promise<void>;
  addSession: (left: string, right: string, type: "directory" | "file") => Promise<void>;
  removeSession: (index: number) => Promise<void>;
}

const MAX_RECENT = 10;

export const useSessionStore = create<SessionState>((set, get) => ({
  recentSessions: [],
  loaded: false,

  load: async () => {
    try {
      const data = await invoke<SessionData>("load_session");
      set({ recentSessions: data.recent_sessions, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addSession: async (left, right, type) => {
    const { recentSessions } = get();
    // Remove duplicate if exists
    const filtered = recentSessions.filter(
      (s) => !(s.left === left && s.right === right),
    );
    const newSession: RecentSession = {
      left,
      right,
      type,
      timestamp: Date.now(),
    };
    const updated = [newSession, ...filtered].slice(0, MAX_RECENT);
    set({ recentSessions: updated });
    try {
      await invoke("save_session", {
        data: { recent_sessions: updated },
      });
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  },

  removeSession: async (index) => {
    const { recentSessions } = get();
    const updated = recentSessions.filter((_, i) => i !== index);
    set({ recentSessions: updated });
    try {
      await invoke("save_session", {
        data: { recent_sessions: updated },
      });
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  },
}));
