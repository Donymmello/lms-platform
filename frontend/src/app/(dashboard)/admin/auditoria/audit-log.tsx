"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api-client";
import { auditService } from "@/services/audit.service";
import { AuditEvent, AuditPage } from "@/types/audit";

/**
 * Reads the audit log. Read-only on purpose: there is no endpoint that edits
 * or removes an entry, because a log an admin can rewrite answers nothing.
 */

/**
 * Each action gets a sentence rather than showing the raw key. `user.
 * role_changed` tells an engineer what happened; "Mudou a função" tells
 * whoever is actually looking.
 */
const LABELS: Record<string, string> = {
  "user.role_changed": "Mudou a função de uma conta",
  "user.activated": "Reactivou uma conta",
  "user.deactivated": "Desactivou uma conta",
  "user.became_instructor": "Passou a instrutor",
  "auth.two_factor_enabled": "Activou a verificação em dois passos",
  "auth.two_factor_disabled": "Desactivou a verificação em dois passos",
  "auth.password_reset_completed": "Concluiu a recuperação de password",
};

const FILTERS: { label: string; action?: string }[] = [
  { label: "Tudo" },
  { label: "Funções", action: "user.role_changed" },
  { label: "Contas desactivadas", action: "user.deactivated" },
  { label: "Dois passos desligado", action: "auth.two_factor_disabled" },
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The metadata shape depends on the action, so this reads what is there and skips what is not. */
function describeDetail(event: AuditEvent): string | null {
  const meta = event.metadata;
  if (!meta) return null;

  const parts: string[] = [];
  if (typeof meta.targetEmail === "string") parts.push(meta.targetEmail);
  if (typeof meta.from === "string" && typeof meta.to === "string") {
    parts.push(`${meta.from} para ${meta.to}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function AuditLog() {
  const [page, setPage] = useState<AuditPage | null>(null);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    auditService
      .list({ page: pageNumber, action })
      .then((loaded) => {
        if (!cancelled) setPage(loaded);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Não foi possível carregar o registo.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, action]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">A carregar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const isActive = filter.action === action;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setAction(filter.action);
                setPageNumber(1);
              }}
              className={`focus-ring min-h-11 rounded-full border px-4 text-sm transition-colors ${
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {page.events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nada registado ainda. Aparecem aqui as mudanças de função, as contas desactivadas e as
          alterações à verificação em dois passos.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {page.events.map((event) => {
            const detail = describeDetail(event);
            return (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="text-sm font-medium">{LABELS[event.action] ?? event.action}</span>
                {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
                <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatWhen(event.createdAt)}
                </span>
                <span className="w-full text-xs text-muted-foreground">
                  {/* The email rather than the id: it survives the account being deleted. */}
                  {event.actorEmail ?? "conta removida"}
                  {event.ip && ` · ${event.ip}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {page.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => current - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {page.pagination.page} de {page.pagination.totalPages} · {page.pagination.total} registos
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pageNumber >= page.pagination.totalPages}
            onClick={() => setPageNumber((current) => current + 1)}
          >
            Seguinte
          </Button>
        </div>
      )}
    </div>
  );
}
