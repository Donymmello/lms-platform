"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/api-client";
import { enrollmentsService } from "@/services/enrollments.service";
import { progressService } from "@/services/progress.service";
import { MyEnrollment } from "@/types/enrollment";
import { CourseProgressSummary } from "@/types/progress";

function formatPrice(cents: number): string {
  return cents === 0
    ? "Gratuito"
    : (cents / 100).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" });
}

export default function StudentCoursesPage() {
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Keyed by courseId. Best-effort — a failed fetch just means no progress
  // bars render, not a blocking error for the whole page.
  const [progressByCourse, setProgressByCourse] = useState<Record<string, CourseProgressSummary>>({});

  useEffect(() => {
    let cancelled = false;

    enrollmentsService
      .listMine()
      .then((result) => {
        if (!cancelled) setEnrollments(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Não foi possível carregar os teus cursos.");
        }
      });

    progressService
      .getMySummary()
      .then((summaries) => {
        if (cancelled) return;
        setProgressByCourse(Object.fromEntries(summaries.map((summary) => [summary.courseId, summary])));
      })
      .catch(() => {
        // Progress bars are a nice-to-have on top of the course list.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Os meus cursos</h1>
        <p className="mt-2 text-muted-foreground">Os cursos em que estás inscrito aparecem aqui.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {!enrollments && !error && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {enrollments && enrollments.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Ainda não estás inscrito em nenhum curso.</p>
          <Link href="/courses" className="mt-2 inline-block text-sm font-medium underline">
            Explorar catálogo
          </Link>
        </div>
      )}

      {enrollments && enrollments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const progress = progressByCourse[enrollment.course.id];
            return (
              <Link key={enrollment.id} href={`/student/courses/${enrollment.course.slug}`}>
                <Card className="flex h-full flex-col transition-colors hover:bg-secondary/40">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{enrollment.course.title}</CardTitle>
                      <Badge variant="secondary">{formatPrice(enrollment.course.priceCents)}</Badge>
                    </div>
                    <CardDescription>Por {enrollment.course.instructor.name}</CardDescription>
                  </CardHeader>
                  {progress && progress.totalLessons > 0 && (
                    <div className="px-6">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {progress.completedLessons} de {progress.totalLessons}{" "}
                        {progress.totalLessons === 1 ? "aula" : "aulas"} · {progress.percent}%
                      </p>
                    </div>
                  )}
                  <CardFooter className="mt-auto text-xs text-muted-foreground">
                    {enrollment.course.moduleCount} {enrollment.course.moduleCount === 1 ? "módulo" : "módulos"}
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
