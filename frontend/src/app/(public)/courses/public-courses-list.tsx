"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Layers, Loader2, Lock, Play, Search } from "lucide-react";

import { CourseCover } from "@/components/studio/course-cover";
import { ApiError } from "@/services/api-client";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseListItem, PaginatedCourses } from "@/types/course";

const PAGE_SIZE = 12;

function CourseTile({ course, index }: { course: CourseListItem; index: number }) {
  const isFree = course.priceCents === 0;

  return (
    <Link
      href={`/courses/${course.slug}`}
      style={{ "--i": index } as React.CSSProperties}
      className="rise group outline-none"
    >
      <article className="focus-ring-group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 group-focus-visible:border-primary">
        <div className="relative aspect-[16/10] overflow-hidden">
          <CourseCover
            slug={course.slug}
            title={course.title}
            thumbnailUrl={course.thumbnailUrl}
            className="transition-transform duration-500 group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/*
            Paid courses carry a padlock; free ones carry none. The price
            itself is deliberately held back until the course page, so the
            grid reads as content rather than as a price list.
          */}
          {isFree ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-primary px-2.5 py-0.5 text-[0.68rem] font-medium text-primary-foreground">
              Grátis
            </span>
          ) : (
            <span
              title="Curso pago"
              className="absolute left-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white/90 backdrop-blur-sm"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="sr-only">Curso pago</span>
            </span>
          )}

          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 scale-90 items-center justify-center rounded-full bg-primary/95 text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 translate-x-[1px] fill-current" />
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-4">
          <h3 className="line-clamp-2 font-medium leading-snug">{course.title}</h3>
          <p className="text-xs text-muted-foreground">{course.instructor.name}</p>
          <p className="mt-auto flex items-center gap-1.5 pt-3 text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/80">
            <Layers className="h-3 w-3" />
            {course.moduleCount} {course.moduleCount === 1 ? "módulo" : "módulos"}
          </p>
        </div>
      </article>
    </Link>
  );
}

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
