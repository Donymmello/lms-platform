"use client";

import { useAuth } from "@/hooks/useAuth";

/**
 * Auth gate only. The chrome (header, container, theme) now belongs to each
 * area's own layout, because the student "estúdio" and the admin panel are
 * deliberately two different visual worlds and shouldn't share a shell.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">A carregar...</div>;
  }

  return <>{children}</>;
}
