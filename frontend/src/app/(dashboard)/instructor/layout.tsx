import Link from "next/link";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";

/**
 * The instructor area is management tooling, so it wears the same light
 * chrome as the admin panel rather than the dark "estúdio" skin used for
 * the learner-facing surfaces.
 */
export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <RoleGuard allow={["ADMIN", "INSTRUCTOR"]} />
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between gap-6">
          <div className="flex items-baseline gap-6">
            <Link href="/instructor" className="text-lg font-semibold">
              LMS Platform
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/instructor" className="text-muted-foreground hover:text-foreground">
                Painel
              </Link>
              <Link href="/instructor/courses" className="text-muted-foreground hover:text-foreground">
                Os meus cursos
              </Link>
            </nav>
          </div>
          <UserNav />
        </div>
      </header>
      <div className="container py-8">{children}</div>
    </div>
  );
}
