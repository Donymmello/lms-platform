import type { Metadata } from "next";
import { AuditLog } from "./audit-log";

export const metadata: Metadata = {
  title: "Auditoria | LMS",
};

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <p className="mt-1 text-muted-foreground">
          Quem mudou funções, quem desactivou contas, e quem mexeu na verificação em dois passos.
          Leituras normais não entram aqui.
        </p>
      </div>
      <AuditLog />
    </div>
  );
}
