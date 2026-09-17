import { PublicNav } from "@/components/shared/public-nav";

/**
 * The catalogue is the shop window for the student area, so it runs on the
 * same "estúdio" skin — a visitor who signs up shouldn't feel like they
 * walked into a different product.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="studio" className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 mt-20 border-t border-border/60">
        <div className="mx-auto flex max-w-shelf flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row lg:px-10">
          <span className="font-display text-base tracking-tight text-foreground">Estúdio</span>
          <span>Aprende ao teu ritmo, onde estiveres.</span>
        </div>
      </footer>
    </div>
  );
}
