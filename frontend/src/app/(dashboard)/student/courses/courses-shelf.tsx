"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Play } from "lucide-react";

import { CourseCover } from "@/components/studio/course-cover";
import { ApiError } from "@/services/api-client";
import { enrollmentsService } from "@/services/enrollments.service";
import { progressService } from "@/services/progress.service";
import { MyEnrollment } from "@/types/enrollment";
import { CourseProgressSummary } from "@/types/progress";

interface Entry {
  enrollment: MyEnrollment;
  progress: CourseProgressSummary | undefined;
}

function ProgressRail({ percent }: { percent: number }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/15">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function CourseCard({ entry, index }: { entry: Entry; index: number }) {
  const { enrollment, progress } = entry;
  const course = enrollment.course;
  const percent = progress?.percent ?? 0;

  return (
    <Link
      href={`/student/courses/${course.slug}`}
      style={{ "--i": index } as React.CSSProperties}
      className="rise group w-[15.5rem] shrink-0 outline-none sm:w-[17.5rem]"
    >
      <article className="overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 group-focus-visible:border-primary">
        <div className="relative aspect-[16/10] overflow-hidden">
          <CourseCover
            slug={course.slug}
            title={course.title}
            thumbnailUrl={course.thumbnailUrl}
            className="transition-transform duration-500 group-hover:scale-[1.06]"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/65 px-2 py-0.5 text-[0.68rem] tracking-wide text-white/85 backdrop-blur-sm">
            {course.moduleCount} {course.moduleCount === 1 ? "módulo" : "módulos"}
          </span>

          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 scale-90 items-center justify-center rounded-full bg-primary/95 text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 translate-x-[1px] fill-current" />
          </span>

          {percent > 0 && (
            <div className="absolute inset-x-2.5 bottom-2.5">
              <ProgressRail percent={percent} />
            </div>
          )}
        </div>

        <div className="space-y-1 p-3.5">
          <h3 className="line-clamp-2 text-[0.92rem] font-medium leading-snug">{course.title}</h3>
          <p className="text-xs text-muted-foreground">{course.instructor.name}</p>
          {progress && progress.totalLessons > 0 && (
            <p className="pt-0.5 text-[0.7rem] uppercase tracking-[0.12em] text-primary/80">
              {percent === 100
                ? "Concluído"
                : `${progress.completedLessons}/${progress.totalLessons} aulas · ${percent}%`}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

function Shelf({ title, entries }: { title: string; entries: Entry[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  // Arrows only earn their place when there is actually something off-screen.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const check = () => setOverflows(rail.scrollWidth > rail.clientWidth + 8);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [entries.length]);

  function scrollBy(direction: -1 | 1) {
    railRef.current?.scrollBy({ left: direction * railRef.current.clientWidth * 0.8, behavior: "smooth" });
  }

  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl tracking-tight sm:text-[1.7rem]">{title}</h2>
        {overflows && (
          <div className="hidden gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`Recuar em ${title}`}
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`Avançar em ${title}`}
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div ref={railRef} className="shelf">
        {entries.map((entry, index) => (
          <CourseCard key={entry.enrollment.id} entry={entry} index={index} />
        ))}
      </div>
    </section>
  );
}

function Hero({ entry }: { entry: Entry }) {
  const course = entry.enrollment.course;
  const percent = entry.progress?.percent ?? 0;
  const started = percent > 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border">
      <div className="absolute inset-0">
        <CourseCover slug={course.slug} title={course.title} thumbnailUrl={course.thumbnailUrl} />
      </div>
      {/* Two stacked washes: one to seat the text, one warm bloom for depth. */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative max-w-2xl space-y-5 p-7 sm:p-10 lg:p-12">
        <p className="text-[0.7rem] uppercase tracking-[0.24em] text-primary">
          {started ? "Continuar a ver" : "Começar agora"}
        </p>

        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {course.title}
        </h1>

        <p className="text-sm text-muted-foreground">
          Por {course.instructor.name} · {course.moduleCount}{" "}
          {course.moduleCount === 1 ? "módulo" : "módulos"}
        </p>

        {entry.progress && entry.progress.totalLessons > 0 && (
          <div className="max-w-sm space-y-1.5">
            <ProgressRail percent={percent} />
            <p className="text-xs text-muted-foreground">
              {entry.progress.completedLessons} de {entry.progress.totalLessons}{" "}
              {entry.progress.totalLessons === 1 ? "aula" : "aulas"} · {percent}%
            </p>
          </div>
        )}

        <Link
          href={`/student/courses/${course.slug}`}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Play className="h-4 w-4 fill-current" />
          {started ? "Retomar" : "Começar"}
        </Link>
      </div>
    </section>
  );
}

export function CoursesShelf() {
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

  /**
   * The shelves are curated entirely from data we already have — no
   * "trending" or "top 10" endpoint needed. A course is in exactly one of
   * them, and the hero is whatever the student is closest to finishing.
   */
  const { hero, inProgress, notStarted, finished } = useMemo(() => {
    const entries: Entry[] = (enrollments ?? []).map((enrollment) => ({
      enrollment,
      progress: progressByCourse[enrollment.course.id],
    }));

    const percentOf = (entry: Entry) => entry.progress?.percent ?? 0;

    const started = entries
      .filter((entry) => percentOf(entry) > 0 && percentOf(entry) < 100)
      .sort((a, b) => percentOf(b) - percentOf(a));

    const fresh = entries
      .filter((entry) => percentOf(entry) === 0)
      .sort(
        (a, b) =>
          new Date(b.enrollment.enrolledAt).getTime() - new Date(a.enrollment.enrolledAt).getTime()
      );

    const done = entries.filter((entry) => percentOf(entry) === 100);

    return {
      hero: started[0] ?? fresh[0] ?? done[0] ?? null,
      inProgress: started,
      notStarted: fresh,
      finished: done,
    };
  }, [enrollments, progressByCourse]);

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!enrollments) {
    return (
      <div className="flex items-center justify-center gap-3 py-28 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">A preparar o teu estúdio...</span>
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border px-8 py-20 text-center">
        <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative space-y-4">
          <h2 className="font-display text-4xl tracking-tight">O estúdio está vazio</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Ainda não estás inscrito em nenhum curso. Escolhe um no catálogo e ele aparece aqui.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Explorar catálogo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {hero && <Hero entry={hero} />}
      <Shelf title="Continuar a ver" entries={inProgress} />
      <Shelf title="Por começar" entries={notStarted} />
      <Shelf title="Concluídos" entries={finished} />
    </div>
  );
}
