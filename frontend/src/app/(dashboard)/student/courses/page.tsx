import type { Metadata } from "next";
import { CoursesShelf } from "./courses-shelf";

export const metadata: Metadata = {
  title: "Os meus cursos | Estúdio",
};

export default function StudentCoursesPage() {
  return (
    <div className="mx-auto max-w-shelf px-6 py-8 lg:px-10 lg:py-12">
      <CoursesShelf />
    </div>
  );
}
