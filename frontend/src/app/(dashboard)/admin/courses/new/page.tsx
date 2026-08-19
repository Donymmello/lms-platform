import type { Metadata } from "next";
import { NewCourseForm } from "./new-course-form";

export const metadata: Metadata = {
  title: "Novo curso | LMS Platform",
};

export default function NewCoursePage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novo curso</h1>
        <p className="mt-1 text-muted-foreground">
          Cria a ficha do curso — módulos e aulas são adicionados a seguir.
        </p>
      </div>
      <NewCourseForm />
    </div>
  );
}
