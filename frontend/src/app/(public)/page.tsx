import Link from "next/link";
import { ArrowRight, CreditCard, GraduationCap, PlayCircle } from "lucide-react";

import { CourseTile } from "@/components/studio/course-tile";
import { HomeCta } from "./home-cta";
import { publicCoursesService } from "@/services/public-courses.service";
import { CourseListItem } from "@/types/course";

/**
 * The landing page.
 *
 * It lives inside the `(public)` group so it inherits the same nav and footer
 * as the catalogue — before, it was a bare centred hero with two buttons and
 * no way out but those buttons.
 *
 * What it shows is the real catalogue, not claims about it. There are no
 * student counts, no testimonials and no ratings here, because the platform
 * does not have any yet and inventing them would be inventing records. The
 * courses that exist are the pitch.
 */

/** Never lets the shop window take the whole site down with it. */
async function featuredCourses(): Promise<CourseListItem[]> {
  try {
    const { courses } = await publicCoursesService.list({ page: 1, pageSize: 6 });
    return courses;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const courses = await featuredCourses();

  return (
    <div>
      {/* --- Hero --- */}
      <section className="relative overflow-hidden px-6 pb-16 pt-20 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="text-[0.7rem] uppercase tracking-[0.24em] text-primary">
            Plataforma de cursos
          </p>

          <h1 className="mt-4 font-display text-5xl leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            O teu <em className="italic text-primary">estúdio</em> de aprendizagem
          </h1>

          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Cursos em vídeo ao teu ritmo. Inscreve-te, assiste onde estiveres, e o teu progresso
            fica guardado.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/courses"
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Explorar catálogo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <HomeCta />
          </div>
        </div>
      </section>

      {/* --- The catalogue, which is the actual argument --- */}
      {courses.length > 0 && (
        <section className="mx-auto max-w-shelf px-6 pb-4 lg:px-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-primary">Em destaque</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                O que podes começar hoje
              </h2>
            </div>
            <Link
              href="/courses"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Ver tudo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, index) => (
              <CourseTile key={course.id} course={course} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* --- How it works: three facts about this platform, not three promises --- */}
      <section className="mx-auto max-w-shelf px-6 py-20 lg:px-10 lg:py-24">
        <h2 className="max-w-lg font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Como funciona
        </h2>

        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          <Step
            icon={<PlayCircle className="h-5 w-5" />}
            step="01"
            title="Escolhe o curso"
            body="Os cursos gratuitos abrem de imediato. Nos pagos, vês o preço e o programa antes de decidires."
          />
          <Step
            icon={<CreditCard className="h-5 w-5" />}
            step="02"
            title="Paga como te dá jeito"
            body="M-Pesa, e-Mola ou PayPal. A inscrição fica activa assim que o pagamento for confirmado."
          />
          <Step
            icon={<GraduationCap className="h-5 w-5" />}
            step="03"
            title="Aprende ao teu ritmo"
            body="O vídeo retoma onde paraste, os materiais ficam disponíveis, e cada módulo termina com uma avaliação."
          />
        </ol>
      </section>

      {/* --- For the other side of the marketplace --- */}
      <section className="mx-auto max-w-shelf px-6 pb-24 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative z-10 max-w-xl">
            <p className="text-[0.7rem] uppercase tracking-[0.24em] text-primary">Para quem ensina</p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              Tens algo para ensinar?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Publica o teu curso aqui. Carregas os vídeos, organizas os módulos e defines o preço —
              a plataforma trata do pagamento e do acesso.
            </p>
            <Link
              href="/ensinar"
              className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Começar a ensinar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/12 text-primary">
          {icon}
        </span>
        <span className="font-display text-2xl leading-none text-muted-foreground/30">{step}</span>
      </div>
      <h3 className="mt-4 font-medium leading-snug">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
