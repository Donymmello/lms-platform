import { AssessmentEditor } from "@/components/courses/assessment-editor";

export default function AdminModuleAssessmentPage({
  params,
}: {
  params: { courseId: string; moduleId: string };
}) {
  return (
    <AssessmentEditor
      moduleId={params.moduleId}
      backHref={`/admin/courses/${params.courseId}`}
    />
  );
}
