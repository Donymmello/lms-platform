"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api-client";
import { coursesService } from "@/services/courses.service";
import { CourseStatus, PaginatedCourses } from "@/types/course";

const STATUS_OPTIONS: CourseStatus[] = ["DRAFT", "PUBLISHED"];
const PAGE_SIZE = 10;

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" });
}

export function CoursesList({ basePath }: { basePath: string }) {
  const [data, setData] = useState<PaginatedCourses | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    coursesService
      .list({ page, pageSize: PAGE_SIZE, search: search || undefined, status: statusFilter || undefined })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Não foi possível carregar os cursos.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Pesquisar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CourseStatus | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos os estados</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "DRAFT" ? "Rascunho" : "Publicado"}
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
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Instrutor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Módulos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}

            {!isLoading && data?.courses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum curso encontrado.
                </td>
              </tr>
            )}

            {!isLoading &&
              data?.courses.map((course) => (
                <tr key={course.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`${basePath}/courses/${course.id}`} className="hover:underline">
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{course.instructor.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={course.status === "PUBLISHED" ? "success" : "secondary"}>
                      {course.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatPrice(course.priceCents)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{course.moduleCount}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total} cursos
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
