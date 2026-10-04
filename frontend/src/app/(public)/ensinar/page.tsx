import type { Metadata } from "next";
import { BarChart3, PlayCircle, Wallet } from "lucide-react";

import { InstructorRequestForm } from "./instructor-request-form";

export const metadata: Metadata = {
  title: "Ensinar na plataforma | LMS",
};

const STEPS = [
  {
    icon: PlayCircle,
    title: "Monta o curso",
    body: "Cria módulos e aulas, carrega os vídeos e escolhe quais ficam como pré-visualização gratuita.",
  },
  {
    icon: Wallet,
    title: "Define o preço",
    body: "Gratuito ou pago em M-Pesa, e-Mola, cartão ou PayPal. O acesso abre sozinho assim que o pagamento é confirmado.",
  },
  {
    icon: BarChart3,
    title: "Acompanha os resultados",
    body: "Receita, inscrições e taxa de conclusão por curso, no teu painel (só dos teus cursos).",
  },
];

export default function TeachPage() {
  return (
    <div className="mx-auto max-w-shelf px-6 py-16 lg:px-10 lg:py-24">
      <header className="relative max-w-2xl">
        <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <p className="relative text-[0.7rem] uppercase tracking-[0.24em] text-primary">
          Ensinar na plataforma
        </p>
        <h1 className="relative mt-3 font-display text-5xl leading-[1.04] tracking-tight sm:text-6xl">
          Passa o que sabes <em className="italic text-primary">a limpo</em>
        </h1>
        <p className="relative mt-5 text-sm leading-relaxed text-muted-foreground">
          Usas a conta que já tens. Pedes acesso de instrutor, um administrador activa, e ganhas um
          painel para criar cursos. Continuas aluno nos que já compraste.
        </p>
        <div className="relative mt-8">
          <InstructorRequestForm />
        </div>
      </header>

      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <article
            key={step.title}
            style={{ "--i": index } as React.CSSProperties}
            className="rise rounded-2xl border border-border bg-card p-6"
          >
            <step.icon className="h-5 w-5 text-primary" />
            <h2 className="mt-4 font-display text-xl tracking-tight">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
