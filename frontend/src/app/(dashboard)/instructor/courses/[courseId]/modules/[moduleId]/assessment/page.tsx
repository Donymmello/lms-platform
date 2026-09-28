import { AssessmentEditor } from "@/components/courses/assessment-editor";

export default function InstructorModuleAssessmentPage({
  params,
}: {
  params: { courseId: string; moduleId: string };
}) {
  return (
    <AssessmentEditor
      moduleId={params.moduleId}
      backHref={`/instructor/courses/${params.courseId}`}
    />
  );
}
