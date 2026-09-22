import Link from "next/link";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";

/**
 * An instructor is a customer of the product, not internal staff, so this
 * area wears the same dark "estúdio" skin as the public catalogue and the
 * student room. Only /admin stays on the light chrome — that one really is
 * internal tooling.
 *
 * The screens themselves are shared with /admin and are entirely
 * token-driven, so they take the palette from this wrapper without a fork.
 */
export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="studio" className="min-h-screen bg-background text-foreground">
      <RoleGuard allow={["ADMIN", "INSTRUCTOR"]} />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
          <Link href="/instructor" className="group flex items-baseline gap-2.5">
            <span className="font-display text-2xl leading-none tracking-tight">Estúdio</span>
            <span className="hidden text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors group-hover:text-primary sm:inline">
              Instrutor
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/instructor"
              className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Painel
            </Link>
            <Link
              href="/instructor/courses"
              className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Os meus cursos
            </Link>
            <Link
              href="/student/courses"
              className="hidden rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-block"
            >
              Aprender
            </Link>
          </nav>

          <div className="shrink-0">
            <UserNav />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-shelf px-6 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
