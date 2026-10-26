"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function UserNav() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {/* Hidden on narrow screens: the email in particular is wide enough to
          push the header out of shape, and neither line is actionable. */}
      <div className="hidden text-right md:block">
        <p className="truncate text-sm font-medium leading-none">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <Link
        href="/definicoes"
        aria-label="Definições da conta"
        title="Definições da conta"
        className="focus-ring grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Settings className="h-5 w-5" aria-hidden="true" />
      </Link>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Sair
      </Button>
    </div>
  );
}
