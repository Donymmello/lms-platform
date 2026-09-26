import type { Metadata } from "next";
import { TwoFactorPanel } from "./two-factor-panel";

export const metadata: Metadata = {
  title: "Segurança | Estúdio",
};

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Segurança</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verificação em dois passos para a tua conta.
        </p>
      </div>
      <TwoFactorPanel />
    </div>
  );
}
