import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TwoFactorPanel } from "../../seguranca/two-factor-panel";

export const metadata = {
  title: "Segurança | Definições | Protagonista Academy",
};

export default function AccountSecurityPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/definicoes"
        className="focus-ring inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Definições da conta
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Acesso e segurança</p>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Segurança</h1>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          Acrescenta uma camada de protecção ao início de sessão da tua conta.
        </p>
      </header>
      <TwoFactorPanel />
    </div>
  );
}
