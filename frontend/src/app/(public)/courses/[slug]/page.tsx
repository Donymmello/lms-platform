import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layers, PlayCircle } from "lucide-react";
import { CourseCover } from "@/components/studio/course-cover";
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
    title: course ? `${course.title} | LMS` : "Curso não encontrado | LMS",
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const course = await getCourse(params.slug);
  if (!course) {
    notFound();
  }

  const lessonCount = course.modules.reduce((total, courseModule) => total + courseModule.lessons.length, 0);
  const previewCount = course.modules.reduce(
    (total, courseModule) => total + courseModule.lessons.filter((lesson) => lesson.isFreePreview).length,
    0
  );

  return (
    <div>
      {/* --- Billboard --- */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0">
          <CourseCover slug={course.slug} title={course.title} thumbnailUrl={course.thumbnailUrl}
            coverKey={course.coverKey} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/50" />
        <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative mx-auto max-w-shelf px-6 py-16 lg:px-10 lg:py-24">
          <div className="max-w-3xl space-y-5">
            {/* The price lives in the enrolment card only — repeating it
                here just made the billboard read as a price tag. */}
            <h1 className="font-display text-5xl leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl">
              {course.title}
            </h1>
            <p className="text-sm text-muted-foreground">Por {course.instructor.name}</p>

            <div className="flex flex-wrap gap-2 pt-1">
              <Stat icon={<Layers className="h-3.5 w-3.5" />}>
                {course.modules.length} {course.modules.length === 1 ? "módulo" : "módulos"}
              </Stat>
              <Stat icon={<PlayCircle className="h-3.5 w-3.5" />}>
                {lessonCount} {lessonCount === 1 ? "aula" : "aulas"}
              </Stat>
              {previewCount > 0 && (
                <Stat icon={<PlayCircle className="h-3.5 w-3.5" />} accent>
                  {previewCount} {previewCount === 1 ? "aula grátis" : "aulas grátis"}
                </Stat>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-shelf gap-10 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-10 lg:py-16">
        <div className="space-y-10">
          {course.description && (
            <section className="space-y-3">
              <h2 className="font-display text-2xl tracking-tight">Sobre o curso</h2>
              <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {course.description}
              </p>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="font-display text-2xl tracking-tight">Conteúdo do curso</h2>
            <CourseCurriculum modules={course.modules} />
          </section>
        </div>

        {/* --- Enrolment card --- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">Acesso vitalício</p>
              <p className="mt-1 font-display text-4xl tracking-tight">{formatPrice(course.priceCents)}</p>
            </div>

            <EnrollButton courseId={course.id} courseSlug={course.slug} priceCents={course.priceCents} />

            <ul className="space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <li>· {lessonCount} {lessonCount === 1 ? "aula em vídeo" : "aulas em vídeo"}</li>
              <li>· Assiste ao teu ritmo, em qualquer dispositivo</li>
              <li>· O teu progresso fica guardado</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  icon,
  children,
  accent = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
        accent ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card/60 text-muted-foreground"
      }`}
    >
      {icon}
      {children}
    </span>
  );
}
