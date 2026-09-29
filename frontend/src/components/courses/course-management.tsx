import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoursesList } from "@/components/courses/courses-list";
import { NewCourseForm } from "@/components/courses/new-course-form";

/**
 * Course authoring is identical for an ADMIN and an INSTRUCTOR — the
 * backend already decides which courses each of them may see and touch — so
 * both areas mount these same screens and differ only in `basePath`.
 */

export function CoursesManager({ basePath }: { basePath: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cursos</h1>
          <p className="mt-1 text-muted-foreground">Criar e gerir cursos, módulos e aulas.</p>
        </div>
        <Button asChild>
          <Link href={`${basePath}/courses/new`}>
            <Plus className="h-4 w-4" />
            Novo curso
          </Link>
        </Button>
      </div>
      <CoursesList basePath={basePath} />
    </div>
  );
}

export function NewCourse({ basePath }: { basePath: string }) {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novo curso</h1>
        <p className="mt-1 text-muted-foreground">
          Cria a ficha do curso. Módulos e aulas vêm a seguir.
        </p>
      </div>
      <NewCourseForm basePath={basePath} />
    </div>
  );
}
