import { CourseEditor } from "@/components/courses/course-editor";

export default function InstructorCourseEditorPage({ params }: { params: { courseId: string } }) {
  return <CourseEditor courseId={params.courseId} basePath="/instructor" />;
}
