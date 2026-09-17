import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";

/** The admin panel keeps the original light chrome, unchanged. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <RoleGuard allow={["ADMIN"]} />
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <span className="text-lg font-semibold">LMS Platform</span>
          <UserNav />
        </div>
      </header>
      <div className="container py-8">{children}</div>
    </div>
  );
}
