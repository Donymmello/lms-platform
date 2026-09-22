import Link from "next/link";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";

/**
 * The student area runs on its own scoped palette (`data-theme="studio"`),
 * so it can be a dark, content-first room without dragging the admin panel
 * into the dark with it.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="studio" className="min-h-screen bg-background text-foreground">
      <RoleGuard allow={["ADMIN", "INSTRUCTOR", "STUDENT"]} />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
          <Link href="/student/courses" className="group flex items-baseline gap-2.5">
            <span className="font-display text-2xl leading-none tracking-tight">Estúdio</span>
            <span className="hidden text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors group-hover:text-primary sm:inline">
              Aprendizagem
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/student/courses"
              className="rounded-full px-3.5 py-1.5 text-foreground transition-colors hover:bg-secondary"
            >
              Os meus cursos
            </Link>
            <Link
              href="/courses"
              className="rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Catálogo
            </Link>
            <Link
              href="/ensinar"
              className="hidden rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-block"
            >
              Ensinar
            </Link>
          </nav>

          <div className="shrink-0">
            <UserNav />
          </div>
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
