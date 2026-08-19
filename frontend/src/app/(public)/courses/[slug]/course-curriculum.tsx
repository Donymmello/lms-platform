import { Lock, PlayCircle } from "lucide-react";
import { CourseModuleItem } from "@/types/course";

export function CourseCurriculum({ modules }: { modules: CourseModuleItem[] }) {
  if (modules.length === 0) {
    return <p className="text-sm text-muted-foreground">Ainda sem conteúdo publicado.</p>;
  }

  return (
    <div className="space-y-2">
      {modules.map((courseModule) => (
        <details key={courseModule.id} className="rounded-lg border border-border" open>
          <summary className="cursor-pointer px-4 py-3 font-medium">{courseModule.title}</summary>
          <ul className="divide-y divide-border border-t border-border">
            {courseModule.lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  {lesson.isFreePreview ? (
                    <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  {lesson.title}
                </span>
                {lesson.isFreePreview && (
                  <span className="text-xs text-muted-foreground">Pré-visualização</span>
                )}
              </li>
            ))}
            {courseModule.lessons.length === 0 && (
              <li className="px-4 py-2.5 text-sm text-muted-foreground">Sem aulas.</li>
            )}
          </ul>
        </details>
      ))}
    </div>
  );
}
