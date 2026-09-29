import type { Metadata } from "next";
import { NewCourse } from "@/components/courses/course-management";

export const metadata: Metadata = {
  title: "Novo curso | LMS",
};

export default function InstructorNewCoursePage() {
  return <NewCourse basePath="/instructor" />;
}
