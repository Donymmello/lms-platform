import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">LMS Platform</h1>
      <p className="max-w-md text-muted-foreground">
        Aprende ao teu ritmo com cursos em vídeo, avaliações e certificados.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Entrar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/register">Criar conta</Link>
        </Button>
      </div>
    </main>
  );
}
