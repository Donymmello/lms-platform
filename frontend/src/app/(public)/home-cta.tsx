"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { homePathForRole } from "@/lib/routes";

/**
 * The landing page's second button.
 *
 * Offering "Entrar" to someone who is already signed in sends them to a page
 * that bounces them straight back. This is the only part of the landing that
 * needs to know who is looking, so it is the only part that runs in the
 * browser — the rest of the page stays a server component.
 *
 * The label follows the destination rather than assuming everyone is a
 * student: an instructor's own area is not "os meus cursos".
 */
export function HomeCta() {
  const { user, isLoading } = useAuth();

  const shell =
    "focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:border-primary/50";

  // The session answer arrives after first paint, so hold the button's exact
  // footprint until then: the alternative is the row reflowing under the
  // cursor a moment after the page appears.
  if (isLoading) {
    return (
      <span aria-hidden className={`${shell} pointer-events-none opacity-0`}>
        Ir para os meus cursos
      </span>
    );
  }

  if (!user) {
    return (
      <Link href="/login" className={shell}>
        Entrar
      </Link>
    );
  }

  return (
    <Link href={homePathForRole(user.role)} className={shell}>
      {user.role === "STUDENT" ? "Ir para os meus cursos" : "Ir para o meu painel"}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
