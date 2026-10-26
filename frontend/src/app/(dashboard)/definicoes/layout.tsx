import Link from "next/link";

import { RoleGuard } from "@/components/shared/role-guard";
import { UserNav } from "@/components/shared/user-nav";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { AccountSettingsNavigation } from "./settings-navigation";

export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="studio" className="min-h-dvh bg-background text-foreground">
      <RoleGuard allow={["ADMIN", "INSTRUCTOR", "STUDENT"]} />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-shelf items-center justify-between gap-6 px-6 lg:px-10">
          <Link href="/" className="focus-ring rounded-md text-2xl">
            <BrandWordmark />
          </Link>
          <UserNav />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 lg:px-10 lg:py-12">
        <div className="grid gap-8 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-12">
          <AccountSettingsNavigation />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
