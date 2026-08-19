import type { Metadata } from "next";
import { PublicCoursesList } from "./public-courses-list";

export const metadata: Metadata = {
  title: "Cursos | LMS Platform",
};

export default function PublicCoursesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cursos</h1>
        <p className="mt-2 text-muted-foreground">
          Explora o catálogo e inscreve-te nos cursos que te interessam.
        </p>
      </div>
      <PublicCoursesList />
    </div>
  );
}
