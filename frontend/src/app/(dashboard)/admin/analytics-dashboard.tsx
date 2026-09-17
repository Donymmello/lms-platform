"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Loader2, TrendingUp, Users, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/services/api-client";
import { analyticsService } from "@/services/analytics.service";
import { AnalyticsOverview, CourseAnalytics, RevenueSeries } from "@/types/analytics";

const RANGE_OPTIONS = [7, 30, 90] as const;

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" });
}

function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Plain CSS bars instead of a charting library — 90 values at most, one
 * number each, so a dependency would cost more than it buys.
 */
function RevenueChart({ series }: { series: RevenueSeries }) {
  const peak = Math.max(...series.points.map((point) => point.revenueCents), 0);

  if (peak === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Ainda não há pagamentos concluídos neste período.
      </p>
    );
  }

  return (
    <div className="flex h-48 items-end gap-[2px]" role="img" aria-label="Receita diária">
      {series.points.map((point) => (
        <div
          key={point.date}
          className="group relative flex-1 rounded-t-sm bg-primary/20 transition-colors hover:bg-primary/40"
          style={{ height: `${Math.max(2, (point.revenueCents / peak) * 100)}%` }}
        >
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 text-xs shadow group-hover:block">
            {formatDayLabel(point.date)} · {formatCurrency(point.revenueCents)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CourseBreakdownTable({ courses }: { courses: CourseAnalytics[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Curso</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium text-right">Inscrições</th>
            <th className="px-4 py-3 font-medium text-right">Receita</th>
            <th className="px-4 py-3 font-medium text-right">Conclusão</th>
          </tr>
        </thead>
        <tbody>
          {courses.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                Ainda não há cursos para reportar.
              </td>
            </tr>
          ) : (
            courses.map((course) => (
              <tr key={course.courseId} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/courses/${course.courseId}`} className="hover:underline">
                    {course.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">{course.totalLessons} aulas</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={course.status === "PUBLISHED" ? "default" : "secondary"}>
                    {course.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{course.enrollments}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(course.revenueCents)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${course.completionPercent}%` }} />
                    </div>
                    <span className="tabular-nums text-muted-foreground">{course.completionPercent}%</span>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [series, setSeries] = useState<RevenueSeries | null>(null);
  const [courses, setCourses] = useState<CourseAnalytics[] | null>(null);
  const [days, setDays] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setError(null);
      try {
        const [nextOverview, nextSeries, nextCourses] = await Promise.all([
          analyticsService.getOverview(),
          analyticsService.getRevenueSeries(days),
          analyticsService.getCourseBreakdown(),
        ]);
        if (cancelled) return;
        setOverview(nextOverview);
        setSeries(nextSeries);
        setCourses(nextCourses);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof ApiError ? caught.message : "Não foi possível carregar as estatísticas.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  if (!overview || !series || !courses) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        A carregar estatísticas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receita total"
          value={formatCurrency(overview.totalRevenueCents)}
          hint={`${overview.totalPayments} pagamentos concluídos`}
          icon={Wallet}
        />
        <StatCard
          label="Inscrições"
          value={String(overview.totalEnrollments)}
          hint={`${overview.totalStudents} alunos distintos`}
          icon={GraduationCap}
        />
        <StatCard
          label="Cursos"
          value={String(overview.totalCourses)}
          hint={`${overview.publishedCourses} publicados`}
          icon={BookOpen}
        />
        <StatCard
          label={`Receita (${series.days}d)`}
          value={formatCurrency(series.totalRevenueCents)}
          hint="Apenas pagamentos concluídos"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Receita diária</CardTitle>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  days === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {option}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <RevenueChart series={series} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Desempenho por curso</h2>
        <CourseBreakdownTable courses={courses} />
      </div>

      <div className="grid gap-4 sm:max-w-2xl sm:grid-cols-2">
        <Link href="/admin/courses">
          <Card className="transition-colors hover:bg-secondary/40">
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Gerir cursos</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="transition-colors hover:bg-secondary/40">
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Gerir utilizadores</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
