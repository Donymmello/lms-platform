import { ChevronDown, Lock, Play } from "lucide-react";
import { CourseModuleItem } from "@/types/course";

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CourseCurriculum({ modules }: { modules: CourseModuleItem[] }) {
  if (modules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Ainda sem conteúdo publicado.
      </p>
    );
  }

  const sorted = [...modules].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {sorted.map((courseModule, moduleIndex) => (
        <details
          key={courseModule.id}
          open
          className="group overflow-hidden rounded-xl border border-border bg-card"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/50">
            <span className="font-display text-xl leading-none text-primary/70">
              {String(moduleIndex + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-sm font-medium">{courseModule.title}</span>
            <span className="text-xs text-muted-foreground">
              {courseModule.lessons.length} {courseModule.lessons.length === 1 ? "aula" : "aulas"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <ul className="border-t border-border">
            {[...courseModule.lessons]
              .sort((a, b) => a.order - b.order)
              .map((lesson) => {
                const duration = formatDuration(lesson.durationSeconds);
                return (
                  <li
                    key={lesson.id}
                    className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        lesson.isFreePreview
                          ? "border-primary/50 text-primary"
                          : "border-border text-muted-foreground/60"
                      }`}
                    >
                      {lesson.isFreePreview ? (
                        <Play className="h-2.5 w-2.5 translate-x-[0.5px] fill-current" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                    </span>

                    <span className="flex-1 truncate text-sm text-muted-foreground">{lesson.title}</span>

                    {lesson.isFreePreview && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.1em] text-primary">
                        Grátis
                      </span>
                    )}

                    {duration && (
                      <span className="shrink-0 text-[0.7rem] tabular-nums text-muted-foreground/70">
                        {duration}
                      </span>
                    )}
                  </li>
                );
              })}

            {courseModule.lessons.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">Sem aulas.</li>
            )}
          </ul>
        </details>
      ))}
    </div>
  );
}
