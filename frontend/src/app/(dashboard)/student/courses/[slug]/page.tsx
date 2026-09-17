import { CourseLearnView } from "./course-learn-view";

export default function CourseLearnPage({ params }: { params: { slug: string } }) {
  return <CourseLearnView slug={params.slug} />;
}
