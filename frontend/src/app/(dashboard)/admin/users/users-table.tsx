"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/services/api-client";
import { usersService } from "@/services/users.service";
import { Role } from "@/types/auth";
import { AdminUser, PaginatedUsers } from "@/types/user";

const ROLE_OPTIONS: Role[] = ["ADMIN", "INSTRUCTOR", "STUDENT"];
const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-PT", { year: "numeric", month: "short", day: "2-digit" });
}

export function UsersTable() {
  const { user: currentUser } = useAuth();

  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Debounce free-text search so we don't fire a request per keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    usersService
      .list({ page, pageSize: PAGE_SIZE, search: search || undefined, role: roleFilter || undefined })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Não foi possível carregar os utilizadores.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, roleFilter]);

  function withPending<T>(id: string, action: () => Promise<T>): Promise<T> {
    setPendingIds((prev) => new Set(prev).add(id));
    return action().finally(() => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  function patchUserInPlace(updated: AdminUser) {
    setData((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === updated.id ? updated : u)) } : prev
    );
  }

  async function handleRoleChange(target: AdminUser, role: Role) {
    if (role === target.role) return;
    try {
      const updated = await withPending(target.id, () => usersService.updateRole(target.id, role));
      patchUserInPlace(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível atualizar a função.");
    }
  }

  async function handleToggleStatus(target: AdminUser) {
    if (target.isActive) {
      const confirmed = window.confirm(
        `Desativar a conta de ${target.name}? A pessoa perde o acesso imediatamente.`
      );
      if (!confirmed) return;
    }

    try {
      const updated = await withPending(target.id, () =>
        usersService.updateStatus(target.id, !target.isActive)
      );
      patchUserInPlace(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível atualizar o estado da conta.");
    }
  }

  if (currentUser && currentUser.role !== "ADMIN") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <p className="text-sm">Só administradores podem gerir utilizadores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Pesquisar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as Role | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todas as funções</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Função</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}

            {!isLoading && data?.users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum utilizador encontrado.
                </td>
              </tr>
            )}

            {!isLoading &&
              data?.users.map((rowUser) => {
                const isSelf = rowUser.id === currentUser?.id;
                const isPending = pendingIds.has(rowUser.id);

                return (
                  <tr key={rowUser.id}>
                    <td className="px-4 py-3 font-medium">
                      {rowUser.name}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(tu)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{rowUser.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={rowUser.role}
                        disabled={isSelf || isPending}
                        onChange={(e) => handleRoleChange(rowUser, e.target.value as Role)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={rowUser.isActive ? "success" : "destructive"}>
                        {rowUser.isActive ? "Ativo" : "Desativado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(rowUser.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf || isPending}
                        onClick={() => handleToggleStatus(rowUser)}
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        {rowUser.isActive ? "Desativar" : "Ativar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total} utilizadores
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
