import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel de administração</h1>
        <p className="mt-2 text-muted-foreground">
          A gestão de vendas vai aparecer aqui. Começa pelos cursos ou utilizadores.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:max-w-2xl">
        <Link href="/admin/courses">
          <Card className="transition-colors hover:bg-secondary/40">
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Cursos</CardTitle>
                <CardDescription>Criar e gerir cursos, módulos e aulas</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="transition-colors hover:bg-secondary/40">
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Utilizadores</CardTitle>
                <CardDescription>Gerir contas, funções e acesso</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
