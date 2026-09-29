import type { Metadata } from "next";
import { PublicCoursesList } from "./public-courses-list";

export const metadata: Metadata = {
  title: "Catálogo | LMS",
};

export default function PublicCoursesPage() {
  return (
    <div className="mx-auto max-w-shelf px-6 py-12 lg:px-10 lg:py-16">
      <header className="relative mb-10 max-w-2xl">
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <p className="relative text-[0.7rem] uppercase tracking-[0.24em] text-primary">Catálogo</p>
        <h1 className="relative mt-3 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Escolhe o que queres <em className="italic text-primary">dominar</em>
        </h1>
        <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">
          Inscreve-te num curso e ele fica na tua área, com o progresso guardado.
        </p>
      </header>

      <PublicCoursesList />
    </div>
  );
}
