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

/**
 * Every component that calls `useAuth` asks the store to hydrate on mount, and
 * a single page has several of them — the dashboard layout, the role guard, the
 * user menu. Without this, one navigation meant three identical `GET /auth/me`
 * round trips, and the answer is the same for all of them. Module scope rather
 * than store state because it is bookkeeping, not something anything renders.
 */
let inFlight: Promise<void> | null = null;
let hydrated = false;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => {
    // A caller that sets the user directly (login, registration) has just
    // learnt the answer, so there is nothing left to go and ask for — and
    // nothing left to wait on either, or the dashboard would sit on its
    // loading screen having never called hydrate.
    hydrated = true;
    set({ user, isLoading: false });
  },

  hydrate: async () => {
    if (hydrated) return;
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        set({ user: await authService.me() });
      } catch {
        // Not signed in — a 401 here is the expected answer, not a failure.
        set({ user: null });
      } finally {
        hydrated = true;
        set({ isLoading: false });
        inFlight = null;
      }
    })();

    return inFlight;
  },

  logout: async () => {
    await authService.logout();
    // Back to unknown: the next mount should ask again rather than trust a
    // cached "nobody is signed in".
    hydrated = false;
    set({ user: null });
  },
}));
