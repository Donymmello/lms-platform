"use client";

import { UserNav } from "@/components/shared/user-nav";
import { useAuth } from "@/hooks/useAuth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">A carregar...</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <span className="text-lg font-semibold">LMS Platform</span>
          <UserNav />
        </div>
      </header>
      <div className="container py-8">{children}</div>
    </div>
  );
}
