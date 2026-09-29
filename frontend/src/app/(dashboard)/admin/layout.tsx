import Link from "next/link";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";

/**
 * The admin panel is the product's one light surface, on purpose: this is
 * where someone reads revenue tables and user lists in daylight, not where
 * they watch video.
 *
 * It wears `data-theme="desk"` — warm paper and ink rather than the stock
 * blue-grey — so it still reads as the same product as the studio, and its
 * chrome is laid out exactly like the student and instructor headers so the
 * navigation does not move when a role changes.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="desk" className="min-h-dvh bg-background text-foreground">
      <RoleGuard allow={["ADMIN"]} />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
          {/*
            The wordmark goes to the site home, the same as it does on the
            public nav and the auth screens. Pointing it at the area's own
            home made it mean "stay here" on exactly the surfaces where
            someone is most likely to want out, and each area already has
            its own home in the nav beside it.
          */}
          <Link href="/" className="focus-ring group flex items-baseline gap-2.5 rounded-md">
            <span className="font-display text-2xl leading-none tracking-tight">LMS</span>
            <span className="hidden text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors group-hover:text-foreground sm:inline">
              Administração
            </span>
          </Link>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
            <AdminNavLink href="/admin">Painel</AdminNavLink>
            <AdminNavLink href="/admin/courses">Cursos</AdminNavLink>
            <AdminNavLink href="/admin/users">Utilizadores</AdminNavLink>
          </nav>

          <div className="shrink-0">
            <UserNav />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-shelf px-6 py-8 lg:px-10 lg:py-10">{children}</div>
    </div>
  );
}

/**
 * Deliberately not marking the current page: `usePathname` would make the
 * whole header a client component, and the panel has three destinations whose
 * headings already say where you are.
 */
function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="focus-ring whitespace-nowrap rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </Link>
  );
}
