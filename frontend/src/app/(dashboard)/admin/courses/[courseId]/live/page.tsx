import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LiveSessionsManager } from "@/components/courses/live-sessions-manager";

export default function AdminLiveSessionsPage({ params }: { params: { courseId: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/courses/${params.courseId}`}
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao curso
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Aulas ao vivo</h1>
        <p className="mt-1 text-muted-foreground">
          Cola o link da reunião e marca a hora. Só quem está inscrito no curso vê o link.
        </p>
      </div>
      <LiveSessionsManager courseId={params.courseId} />
    </div>
  );
}
