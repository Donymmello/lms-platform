"use client";

import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Role } from "@/types/auth";

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  INSTRUCTOR: "Instrutor",
  STUDENT: "Aluno",
};

export default function AccountSettingsPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">A tua conta</p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Definições</h1>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Consulta os dados da tua conta e gere o acesso à plataforma.
        </p>
      </header>

      <section aria-labelledby="account-details-title" className="space-y-4">
        <div>
          <h2 id="account-details-title" className="text-lg font-semibold">
            Dados da conta
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Informações associadas ao teu perfil.</p>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          <div className="flex items-start gap-4 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Perfil</p>
              {isLoading ? (
                <div className="mt-2 h-4 w-40 animate-pulse rounded bg-secondary" />
              ) : (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {user?.name ?? "Conta"}{user?.role ? ` · ${roleLabels[user.role]}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Email de início de sessão</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {isLoading ? "A carregar…" : user?.email}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="account-access-title" className="space-y-4">
        <div>
          <h2 id="account-access-title" className="text-lg font-semibold">
            Acesso e segurança
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Protege a tua conta e controla os métodos de autenticação.
          </p>
        </div>

        <Link
          href="/definicoes/seguranca"
          className="focus-ring group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/30"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Verificação em dois passos</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Configura a aplicação autenticadora e os códigos de recuperação.
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>

        <Link
          href="/forgot-password"
          className="focus-ring group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/30"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Redefinir palavra-passe</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Receba no seu email uma ligação segura para definir uma nova palavra-passe.
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </section>
    </div>
  );
}
