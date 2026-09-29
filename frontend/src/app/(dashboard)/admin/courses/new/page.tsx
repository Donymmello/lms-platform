import type { Metadata } from "next";
import { NewCourse } from "@/components/courses/course-management";

export const metadata: Metadata = {
  title: "Novo curso | LMS",
};

export default function NewCoursePage() {
  return <NewCourse basePath="/admin" />;
}
