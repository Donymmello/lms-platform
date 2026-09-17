import { CourseEditor } from "@/components/courses/course-editor";

export default function CourseEditorPage({ params }: { params: { courseId: string } }) {
  return <CourseEditor courseId={params.courseId} basePath="/admin" />;
}
