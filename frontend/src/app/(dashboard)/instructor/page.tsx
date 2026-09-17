import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/courses/analytics-dashboard";

export const metadata: Metadata = {
  title: "Painel do instrutor | LMS Platform",
};

export default function InstructorDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel do instrutor</h1>
        <p className="mt-1 text-muted-foreground">
          Receita, inscrições e desempenho dos cursos que lecionas.
        </p>
      </div>
      {/* The backend scopes every figure to this instructor's own courses. */}
      <AnalyticsDashboard basePath="/instructor" />
    </div>
  );
}
