"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/services/api-client";
import { publicCoursesService } from "@/services/public-courses.service";
import { PaginatedCourses } from "@/types/course";

const PAGE_SIZE = 12;

function formatPrice(cents: number): string {
  return cents === 0
    ? "Gratuito"
    : (cents / 100).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" });
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
    <div className="space-y-6">
      <Input
        placeholder="Pesquisar cursos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-xs"
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && data?.courses.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">Nenhum curso encontrado.</p>
      )}

      {!isLoading && data && data.courses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.slug}`}>
              <Card className="flex h-full flex-col transition-colors hover:bg-secondary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{course.title}</CardTitle>
                    <Badge variant="secondary">{formatPrice(course.priceCents)}</Badge>
                  </div>
                  <CardDescription>Por {course.instructor.name}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto text-xs text-muted-foreground">
                  {course.moduleCount} {course.moduleCount === 1 ? "módulo" : "módulos"}
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
