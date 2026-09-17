"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="font-display text-2xl leading-none tracking-tight">Estúdio</span>
          <span className="hidden text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors group-hover:text-primary sm:inline">
            Aprendizagem
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href="/courses"
            className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Catálogo
          </Link>

          {!isLoading && user && (
            <>
              <Link
                href={user.role === "STUDENT" ? "/student/courses" : "/admin"}
                className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                A minha área
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-border px-3.5 py-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                Sair
              </button>
            </>
          )}

          {!isLoading && !user && (
            <>
              <Link
                href="/login"
                className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground transition-transform hover:scale-[1.04]"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
