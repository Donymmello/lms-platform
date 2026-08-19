import { CourseEditor } from "./course-editor";

export default function CourseEditorPage({ params }: { params: { courseId: string } }) {
  return <CourseEditor courseId={params.courseId} />;
}
