import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/courses/analytics-dashboard";

export const metadata: Metadata = {
  title: "Painel de administração | LMS",
};

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel de administração</h1>
        <p className="mt-1 text-muted-foreground">Receita, inscrições e desempenho dos cursos.</p>
      </div>
      <AnalyticsDashboard basePath="/admin" canManageUsers />
    </div>
  );
}
