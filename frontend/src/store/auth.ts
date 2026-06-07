import { create } from "zustand";
import api from "@/lib/api";

interface AuthState {
  user: { id: string; email: string; fullName: string } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    const me = await api.get("/users/me");
    set({ user: me.data });
  },

  register: async (email, password, fullName) => {
    const res = await api.post("/auth/register", { email, password, fullName });
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    const me = await api.get("/users/me");
    set({ user: me.data });
  },

  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ user: null });
    window.location.href = "/login";
  },

  fetchMe: async () => {
    try {
      set({ loading: true });
      const res = await api.get("/users/me");
      set({ user: res.data });
    } catch {
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },
}));
