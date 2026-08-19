import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/services/api-client";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseCurriculum } from "./course-curriculum";
import { EnrollButton } from "./enroll-button";

interface CourseDetailPageProps {
  params: { slug: string };
}

async function getCourse(slug: string) {
  try {
    return await publicCoursesService.getBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

function formatPrice(cents: number): string {
  return cents === 0
    ? "Gratuito"
    : (cents / 100).toLocaleString("pt-MZ", { style: "currency", currency: "MZN" });
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const course = await getCourse(params.slug);
  return {
    title: course ? `${course.title} | LMS Platform` : "Curso não encontrado | LMS Platform",
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const course = await getCourse(params.slug);
  if (!course) {
    notFound();
  }

  const lessonCount = course.modules.reduce((total, courseModule) => total + courseModule.lessons.length, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <p className="mt-2 text-muted-foreground">Por {course.instructor.name}</p>
        </div>

        {course.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed">{course.description}</p>
        )}

        <div>
          <h2 className="text-lg font-semibold">Conteúdo do curso</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {course.modules.length} {course.modules.length === 1 ? "módulo" : "módulos"} · {lessonCount}{" "}
            {lessonCount === 1 ? "aula" : "aulas"}
          </p>
          <CourseCurriculum modules={course.modules} />
        </div>
      </div>

      <div>
        <div className="sticky top-8 space-y-4 rounded-lg border border-border p-6">
          <p className="text-2xl font-bold">{formatPrice(course.priceCents)}</p>
          <EnrollButton courseId={course.id} courseSlug={course.slug} priceCents={course.priceCents} />
        </div>
      </div>
    </div>
  );
}
