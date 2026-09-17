import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main
      data-theme="studio"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground"
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 max-w-2xl space-y-7">
        <p className="text-[0.7rem] uppercase tracking-[0.24em] text-primary">Plataforma de cursos</p>

        <h1 className="font-display text-6xl leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl">
          O teu <em className="italic text-primary">estúdio</em> de aprendizagem
        </h1>

        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Cursos em vídeo ao teu ritmo. Inscreve-te, assiste onde estiveres, e o teu progresso
          fica guardado.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Explorar catálogo
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:border-primary/50"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
