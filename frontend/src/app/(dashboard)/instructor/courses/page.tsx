import type { Metadata } from "next";
import { CoursesManager } from "@/components/courses/course-management";

export const metadata: Metadata = {
  title: "Os meus cursos | LMS",
};

export default function InstructorCoursesPage() {
  return <CoursesManager basePath="/instructor" />;
}
