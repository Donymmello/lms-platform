import { create } from "zustand";
import { authService } from "@/services/auth.service";
import { User } from "@/types/auth";

interface AuthState {
  user: User | null;
  /** True while the initial "am I already logged in?" check is in flight. */
  isLoading: boolean;
  setUser: (user: User | null) => void;
  /** Calls GET /auth/me to hydrate `user` from the httpOnly cookie session, if any. */
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  hydrate: async () => {
    try {
      const user = await authService.me();
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null });
  },
}));
