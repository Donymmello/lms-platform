import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoursesList } from "./courses-list";

export const metadata: Metadata = {
  title: "Cursos | LMS Platform",
};

export default function AdminCoursesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cursos</h1>
          <p className="mt-1 text-muted-foreground">Criar e gerir cursos, módulos e aulas.</p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="h-4 w-4" />
            Novo curso
          </Link>
        </Button>
      </div>
      <CoursesList />
    </div>
  );
}
