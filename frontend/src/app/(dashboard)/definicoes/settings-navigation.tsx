"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2, ShieldCheck } from "lucide-react";

const sections = [
  { href: "/definicoes", label: "A minha conta", icon: Settings2 },
  { href: "/definicoes/seguranca", label: "Segurança", icon: ShieldCheck },
];

export function AccountSettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Definições da conta" className="space-y-1">
      <p className="mb-3 px-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Definições
      </p>
      {sections.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
              isActive
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
