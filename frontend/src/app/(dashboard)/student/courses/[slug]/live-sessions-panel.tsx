"use client";

import { useEffect, useState } from "react";
import { Radio, Video } from "lucide-react";

import { liveSessionsService } from "@/services/live-sessions.service";
import { LiveSession } from "@/types/live-session";

/** "sáb, 27 set, 14:30" — enough to plan around without a full timestamp. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionRow({ session }: { session: LiveSession }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          session.isLive ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
        }`}
      >
        {session.isLive ? <Radio className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{session.title}</p>
        <p className="text-xs text-muted-foreground">
          {session.isLive ? (
            <span className="text-primary">A decorrer agora</span>
          ) : (
            <>
              {formatWhen(session.startsAt)} · {session.durationMinutes} min
            </>
          )}
        </p>
      </div>

      {session.joinUrl && (
        <a
          href={session.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-transform hover:scale-[1.04] ${
            session.isLive
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Entrar
        </a>
      )}
    </li>
  );
}

/**
 * Scheduled live classes for a course. Renders nothing at all when there are
 * none, or when the fetch fails — this sits beside the lesson list and is not
 * worth an error banner of its own.
 */
export function LiveSessionsPanel({ courseId }: { courseId: string }) {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    liveSessionsService
      .listForCourse(courseId)
      .then((result) => {
        if (!cancelled) setSessions(result);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (!sessions || sessions.length === 0) return null;

  // A session that finished hours ago is clutter; keep today's and anything ahead.
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  const upcoming = sessions.filter((session) => new Date(session.startsAt).getTime() > cutoff);
  if (upcoming.length === 0) return null;

  const hasLive = upcoming.some((session) => session.isLive);

  return (
    <section className="mb-4">
      <h2 className="mb-3 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
        Aulas ao vivo
        {hasLive && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] tracking-normal text-primary">
            ao vivo
          </span>
        )}
      </h2>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {upcoming.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </ul>
    </section>
  );
}
