"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { homePathForRole } from "@/lib/routes";

export function PublicNav() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { count: cartCount } = useCart();

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="font-display text-2xl leading-none tracking-tight">LMS</span>
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

          {/*
            Only once there is something in it. An empty cart icon on every
            page is a nag; a count is information.
          */}
          {cartCount > 0 && (
            <Link
              href="/carrinho"
              className="focus-ring relative rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] font-medium tabular-nums text-primary-foreground">
                {cartCount}
              </span>
              <span className="sr-only">
                Carrinho, {cartCount} {cartCount === 1 ? "curso" : "cursos"}
              </span>
            </Link>
          )}

          {!isLoading && (!user || user.role === "STUDENT") && (
            <Link
              href="/ensinar"
              className="hidden rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-block"
            >
              Ensinar
            </Link>
          )}

          {!isLoading && user && (
            <>
              <Link
                href={homePathForRole(user.role)}
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
