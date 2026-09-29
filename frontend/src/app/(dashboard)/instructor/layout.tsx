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
    <div data-theme="studio" className="min-h-dvh bg-background text-foreground">
      <RoleGuard allow={["ADMIN", "INSTRUCTOR"]} />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
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
            <span className="hidden text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground transition-colors group-hover:text-primary sm:inline">
              Instrutor
            </span>
          </Link>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
            <Link
              href="/instructor"
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Painel
            </Link>
            <Link
              href="/instructor/courses"
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Os meus cursos
            </Link>
            <Link
              href="/student/courses"
              className="hidden whitespace-nowrap rounded-full px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-block"
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
