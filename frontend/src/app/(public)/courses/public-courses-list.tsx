"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { CourseTile } from "@/components/studio/course-tile";
import { ApiError } from "@/services/api-client";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseListItem, PaginatedCourses } from "@/types/course";

const PAGE_SIZE = 12;

export function PublicCoursesList() {
  const [data, setData] = useState<PaginatedCourses | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
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

    publicCoursesService
      .list({ page, pageSize: PAGE_SIZE, search: search || undefined })
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
  }, [page, search]);

  return (
    <div className="space-y-8">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Pesquisar cursos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="focus-ring h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">A carregar o catálogo...</span>
        </div>
      )}

      {!isLoading && data?.courses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <h2 className="font-display text-3xl tracking-tight">Nada por aqui</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {search ? `Nenhum curso corresponde a "${search}".` : "Ainda não há cursos publicados."}
          </p>
        </div>
      )}

      {!isLoading && data && data.courses.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.courses.map((course, index) => (
            <CourseTile key={course.id} course={course} index={index} />
          ))}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-6 text-sm">
          <span className="text-muted-foreground">
            Página {data.pagination.page} de {data.pagination.totalPages} · {data.pagination.total} cursos
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-border px-4 py-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-border px-4 py-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
