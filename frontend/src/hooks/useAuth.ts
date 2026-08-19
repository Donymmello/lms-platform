"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";

/**
 * Hydrates the auth store from the session cookie on first mount and
 * exposes the current user + loading state. Safe to call from multiple
 * components — zustand dedupes the underlying state.
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const hydrate = useAuthStore((state) => state.hydrate);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, isLoading, isAuthenticated: !!user, logout };
}
