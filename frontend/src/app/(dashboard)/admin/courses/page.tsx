import type { Metadata } from "next";
import { CoursesManager } from "@/components/courses/course-management";

export const metadata: Metadata = {
  title: "Cursos | LMS",
};

export default function AdminCoursesPage() {
  return <CoursesManager basePath="/admin" />;
}
