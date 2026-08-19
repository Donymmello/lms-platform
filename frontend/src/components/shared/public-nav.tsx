"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function PublicNav() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          LMS Platform
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/courses" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Cursos
          </Link>

          {!isLoading && user && (
            <div className="flex items-center gap-3">
              <Link
                href={user.role === "STUDENT" ? "/student/courses" : "/admin"}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                A minha área
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          )}

          {!isLoading && !user && (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Criar conta</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
