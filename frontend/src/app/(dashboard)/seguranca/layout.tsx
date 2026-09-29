import Link from "next/link";
import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";

/** Account settings belong to everyone who has an account, whatever their role. */
export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="studio" className="min-h-dvh bg-background text-foreground">
      <RoleGuard allow={["ADMIN", "INSTRUCTOR", "STUDENT"]} />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
          <Link href="/" className="font-display text-2xl leading-none tracking-tight">
            LMS
          </Link>
          <UserNav />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}
