import Link from "next/link";
import { Layers, Lock, Play } from "lucide-react";

import { CourseCover } from "@/components/studio/course-cover";
import { CourseListItem } from "@/types/course";

/**
 * One course in a grid or shelf. Shared by the catalogue and the landing page
 * so the two cannot drift — the padlock rule in particular is a product
 * decision, not a per-page detail.
 */
export function CourseTile({ course, index }: { course: CourseListItem; index: number }) {
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
            coverKey={course.coverKey}
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
