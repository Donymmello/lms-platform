import Link from "next/link";

/**
 * Sign-in sits between the catalogue and the student area, so it wears the
 * same "estúdio" skin — landing on a white form mid-flow broke the spell.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-theme="studio"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground"
    >
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <Link href="/" className="relative z-10 mb-8 flex items-baseline gap-2.5">
        <span className="font-display text-3xl leading-none tracking-tight">Estúdio</span>
        <span className="text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
          Aprendizagem
        </span>
      </Link>

      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </main>
  );
}
